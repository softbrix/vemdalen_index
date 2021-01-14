"use strict"
/**
This file describes the index redis connection module for the keyword store and lookup

The index redis module stores all information to the redis instance.
*/

var redis = require("redis");
const { promisify } = require("util");

const STRING_INDEX = 1;
const STRING_ARRAY_INDEX = 2;
const STRING_UNIQUE_ARRAY_INDEX = 3;
const OBJECT_INDEX = 4;

function getIndexType(typeString) {
  if(typeString === undefined || typeString === 'strings') {
    return STRING_ARRAY_INDEX;
  } else if(typeString === 'strings_unique') {
    return STRING_UNIQUE_ARRAY_INDEX;
  } else if(typeString === 'string') {
    return STRING_INDEX;
  } else if(typeString === 'object') {
    return OBJECT_INDEX;
  }
  throw new Error('Unknown index type: ' + typeString);
}

function isString(str) {
  return str !== undefined && (typeof str === 'string' || str instanceof String);
}

module.exports = function(namespace, config) {
  namespace = namespace || '';
  config = config || {};
  config.host = config.host || 'localhost';
  config.port = config.port || 6379;

  const _indexType = getIndexType(config.indexType);
  namespace = namespace === '' || namespace.endsWith(':') ? namespace : namespace + ':';
  let redisClient;
  if(config.client) {
    redisClient = config.client;
  } else {
    redisClient = redis.createClient(config);
  }

  const delAsync = promisify(redisClient.del).bind(redisClient);
  const getAsync = promisify(redisClient.get).bind(redisClient);
  const keysAsync = promisify(redisClient.keys).bind(redisClient);
  const lpushAsync = promisify(redisClient.lpush).bind(redisClient);
  const lrangeAsync = promisify(redisClient.lrange).bind(redisClient);
  const setAsync = promisify(redisClient.set).bind(redisClient);

  return {
    /**
    Clear the entier index by deleting all the keys
    */
    clear: function() {
      let deleteFunc = this.delete;
      return this.keys().then(function(keys) {
        var promises = keys.map(key => deleteFunc(key));
        return Promise.all(promises);
      });
    },

    /**
    Expects a key string and defined value as parameters. These will be added to
    the internal index
    */
    put : async function(key, value) {
      if(!isString(key) || key.length === 0) {
        return Promise.reject('Key must be an non empty string: ' + key);
      }
      if(value === undefined) {
        return Promise.reject('Value must not be undefined: ' + value);
      }
      
      if(_indexType === OBJECT_INDEX) {
        value = JSON.stringify(value);
      } 
      if(!isString(value)) {
        return reject('Value must be a string when storing strings: ' + value);
      }

      if(_indexType === STRING_UNIQUE_ARRAY_INDEX) {
        // We need to check if the value already exists
        let values = await this.get(key)
        if(values.indexOf(value) >= 0) {
          return;
        }
      } 
       
      key = namespace + key;

      if(_indexType === STRING_ARRAY_INDEX || _indexType === STRING_UNIQUE_ARRAY_INDEX) {
        return lpushAsync(key, value);
      }
      return setAsync(key, value);
    },

    /**
     Return all items for the matching key
     */
    get : async function(key) {
      if(!isString(key) || key.length === 0) {
        return Promise.reject("Key must be an non empty string: " + key);
      }
      key = namespace + key;

      let res;
      if(_indexType === OBJECT_INDEX) {
        res = JSON.parse(await getAsync(key));
      } else if(_indexType === STRING_INDEX) {
        res = await getAsync(key);
      } else if(_indexType === STRING_ARRAY_INDEX || _indexType === STRING_UNIQUE_ARRAY_INDEX) {
        res = lrangeAsync(key, 0, -1);
        // Prevent returning null, empty array means the same
        if(res === null) {
          res = [];
        }
      }
      return res;
    },

    /* Delete a key */
    delete: function(key) {
      if(!isString(key) || key.length === 0) {
        return Promise.reject("Key must be an non empty string: " + key);
      }
      return delAsync(namespace + key);
    },

    /** Update a key is remove then put */
    update : function(key, value) {
      let putFunc = this.put;
      return this.delete(key).then(() => {
        return putFunc(key, value);
      });
    },

    /**
    Search for matching keys.
    Only a list of keys is returned which then can be used to lookup the values.
    **/
    search : function(searchStr) {
      return keysAsync(namespace + searchStr + '*');
    },

    /**
    The list of stored keys
    */
    keys : function() {
      return keysAsync(namespace + '*')
        // Remove namespace from the returned keys
        .then(keys => keys.map(key => key.substring(namespace.length)));
    },

    /** Return the number of keys in the index */
    size : function() {
      return this.keys().then(keys => keys.length);
    },

    /** Close the redis connection **/
    quit : redisClient.quit
  };
};
