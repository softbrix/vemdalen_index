"use strict"
/**
This file describes the index redis connection module for the keyword store and lookup

The index redis module stores all information to the redis instance.
*/

var redis = require("redis");

const STRING_INDEX = 0;
const STRING_ARRAY_INDEX = 1;
const STRING_UNIQUE_ARRAY_INDEX = 2;
const OBJECT_INDEX = 3;

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

  function callbackFactory(resolve, reject) {
    return function(err, res) {
      if(err) {
        reject(err);
      } else {
        resolve(res);
      }
    };
  }

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
    put : function(key, value) {
      if(!isString(key) || key.length === 0) {
        return Promise.reject('Key must be an non empty string');
      }
      if(value === undefined) {
        return Promise.reject('Value must not be undefined');
      }
      let that = this;

      return new Promise(function(resolve, reject) {
        var callbackHandler = callbackFactory(resolve, reject);

        if(_indexType === OBJECT_INDEX) {
          key = namespace + key;
          redisClient.hmset(key, value, callbackHandler);
        } else {
          if(!isString(value)) {
            return reject('Value must be a string when storing strings');
          }
          let putStringValue = () => {
            key = namespace + key;
            if(_indexType === STRING_INDEX) {
              redisClient.set(key, value, callbackHandler);
            } else if(_indexType === STRING_ARRAY_INDEX || _indexType === STRING_UNIQUE_ARRAY_INDEX) {
              redisClient.lpush(key, value, callbackHandler);
            }
          };

          if(_indexType === STRING_UNIQUE_ARRAY_INDEX) {
            // We need to check if the value already exists
            that.get(key).then(values => {
              if(values.indexOf(value) < 0) {
                return putStringValue();
              } else {
                callbackHandler();
              }
            });
          } else {
            putStringValue();
          }
        }
      });
    },

    /**
     Return all items for the matching key
     */
    get : function(key) {
      if(!isString(key) || key.length === 0) {
        return Promise.reject("Key must be an non empty string");
      }
      key = namespace + key;

      return new Promise(function(resolve, reject) {
        var callback = callbackFactory(resolve, reject);

        if(_indexType === OBJECT_INDEX) {
          redisClient.hgetall(key, callback);
        } else if(_indexType === STRING_INDEX) {
          redisClient.get(key, callback);
        } else if(_indexType === STRING_ARRAY_INDEX || _indexType === STRING_UNIQUE_ARRAY_INDEX) {
          redisClient.lrange(key, 0, -1, function(err, res) {
            // Prevent returning null, empty array means the same
            if(res === null) {
              res = [];
            }
            callback(err, res);
          });
        }
      });
    },

    /* Delete a key */
    delete: function(key) {
      if(!isString(key) || key.length === 0) {
        return Promise.reject("Key must be an non empty string");
      }
      key = namespace + key;

      return new Promise(function(resolve, reject) {
        var callbackHandler = callbackFactory(resolve, reject);
        if(_indexType === OBJECT_INDEX) {
          redisClient.hdel(key, callbackHandler);
        } else {
          redisClient.del(key, callbackHandler);
        }
      });
    },

    /** Update a key is remove then put */
    update : function(key, value) {
      let putFunc = this.put;
      return this.delete(key).then(function() {
        return putFunc(key, value);
      });
    },

    /**
    Search for matching keys.
    Only a list of keys is returned which then can be used to lookup the values.
    **/
    search : function(searchStr) {
      return new Promise(function(resolve, reject) {
        var callbackHandler = callbackFactory(resolve, reject);

        redisClient.keys(namespace + searchStr + '*', callbackHandler);
      });
    },

    /**
    The list of stored keys
    */
    keys : function() {
      return new Promise(function(resolve, reject) {
        var callbackHandler = callbackFactory(resolve, reject);
        redisClient.keys(namespace + '*', callbackHandler);
      })
      // Remove namespace from the returned keys
      .then(keys => keys.map(key => key.substring(namespace.length)));
    },

    /** Return the number of keys in the index */
    size : function() {
      return this.keys().then(keys => keys.length);
    }
  };
};
