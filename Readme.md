[![Build Status](https://travis-ci.org/softbrix/vemdalen_index.svg?branch=master)](https://travis-ci.org/softbrix/vemdalen_index)

# Vemdalen Index
This is an wrapper for the redis key/value store. It simplifies the interface to
 the datastore to be able to handle different types of data without to much headache.
It will also handle data prefixes/namepaces and this makes it possible to easily
 separate and isolate your data into different data domains.

The only thing you need to know is what type of data to store. The default is a
string list which supports multiple values being stored with the same key.
The other datatypes which are supported are pure string and Object.

Create the index instance by simply requiring the module and create a
new instance of the object. The instance creation will take a namespace and
connection configuration as arguments.

Then you can use the put, get and search methods to modify the index.

## Method description
- clear(): This method will clear all keys and values in the index.
- put(key, value): The first argument to the put method is the key and the second is the value.
  If string lists are used then the value will be pushed to the list. If using
  string or objects are used then the previous value will be overwritten.
- get(key): Return the value for the given key
- delete(key): Delete a given key and its value from the index.
- update(key, value): Will first delete the key and then set the new value for the key.
- search(pattern): Will return the keys for the matching pattern. To get the value you need
to call get for each and every of them.
- keys(): Returns all the keys in the index
- size(): Return the number of keys


## External dependencies
Nothing else than the Redis data store and the npm redis client.



## Why Vemdalen?
Vemdalen is a small and family friendly ski resort in the middle of Sweden. In
the beginning of February 2018 I spent a week here with some friends. Out skiing
downhill and cross country during the days and playing games and coding during
the evenings.
I started to think of a wrapper for redis to simplify get and set functionality
  and migrating the interface from my other index to this.
