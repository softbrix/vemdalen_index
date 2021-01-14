var assert = require('assert');
var shIndex = require('../index.js');
var fakeRedis = require("redis-mock");

const INDEX_NAMESPACE = 'index_unit_test';

function random(from, to) {
  return from + Math.floor(Math.random() * (to-from));
}

function times(count, func) {
  for(var i = 0; i < count; ++i) {
    func();
  }
}

describe('Shatabang Mocked Index', () => {
  let redisClient = fakeRedis.createClient();
  const idx = shIndex(INDEX_NAMESPACE,{client: redisClient});

  it('should handle put in different keys', () => {
    var tasks = [
      idx.put('as', 'the beste1'),
      idx.put('asa', 'the beste2'),
      idx.put('asas', 'the beste3'),
      idx.put('asasas', 'the beste4')];

    return Promise.all(tasks);
  });

  xit('should handle quit', () => {
    return idx.put('asb', 'the beste1')
      .then(() => redisClient.quit())
      .then(() => idx.get('asb'))
      .then(assert.fail, assert.ok );
  });
});

/** Enable this if you want to clear the entire redis database */
describe('Shatabang clear database', () => {
  const idx = shIndex();

  it('should start empty', () => {
    return idx.clear().then(function() {
      return idx.size().then((sz) => assert.equal(0, sz));
    });
  });
})

describe('Shatabang Index', () => {
  // Connects to the default instance
  const idx = shIndex(INDEX_NAMESPACE,{});

  it('should start empty', () => {
    return idx.clear().then(function() {
      return idx.size().then((sz) => assert.equal(0, sz));
    });
  });

  it('get should return empty array for unknown key', () => {
    return idx.get('aaa').then(val => assert.deepEqual([], val));
  });

  it('search should return empty array for unknown key', () => {
    return idx.search('aaa').then(val => assert.deepEqual([], val));
  });

  it('get should reject if key is not string', () => {
    return idx.get(12).then(assert.fail, assert.ok);
  });

  it('put should reject if key is not string', () => {
    return idx.put(12, 'Ignore').then(assert.fail, assert.ok);
  });

  it('should handle put in different keys', () => {
    var tasks = [
      idx.put('as', 'the beste1'),
      idx.put('asa', 'the beste2'),
      idx.put('asas', 'the beste3'),
      idx.put('asasas', 'the beste4')];

    return Promise.all(tasks).then(function() {
      return idx.size().then(sz => assert.equal(4, sz));
    });
  });

  it('should handle wide search in different keys', () => {
    var tasks = [
      idx.put('as', 'the beste1'),
      idx.put('asa', 'the beste2'),
      idx.put('asas', 'the beste3'),
      idx.put('asasas', 'the beste4')];

    return Promise.all(tasks).then(function() {
      return idx.search('asas').then(res => assert.equal(2, res.length));
    });
  });

  it('should handle put with same key', () => {
    const KEY = 'asabo';
    const VAL1 = 'the beste1';
    const VAL2 = 'the beste2';
    const VAL3 = 'the beste3';
    var tasks = [
      idx.put(KEY, VAL1),
      idx.put(KEY, VAL2),
      idx.put(KEY, VAL3)];

    return Promise.all(tasks).then(function() {
      return idx.get(KEY).then(res => assert.deepEqual([VAL3, VAL2, VAL1], res));
    });
  });

  it('should handle put with complex key', () => {
    const KEY = '*$HDv>J7{$}s&N*+Gm=sZ@+9E!WL):!ZhT)?SofkHM^{YKE&FTADDFRErY%YDvfprAd-)[DWp6/u$9+@zFJ%1xLq{gBz+/cx(4D]H<ixour7fiuT[.AHJcZgurQAf';
    const VAL1 = 'val1';
    return idx.put(KEY, VAL1).then(function() {
      return idx.get(KEY).then(res => assert.deepEqual([VAL1], res));
    });
  });

  it('should allow colon in the key', () => {
    const KEY = 'abc:def';
    const VAL1 = 'val1';
    return idx.put(KEY, VAL1).then(assert.ok, assert.fail);
  });

  it('should handle delete by valid key', () => {
    const KEY = 'asabo';
    return idx.get(KEY).then(res => assert.equal(3, res.length))
    .then(function() { return idx.delete(KEY) })
    .then(function() { return idx.get(KEY).then(res => assert.equal(0, res.length))});
  });

  it('should handle delete by unused key', () => {
    const KEY = 'asakrassa';
    return idx.get(KEY)
    .then(res => assert.deepEqual([], res))
    .then(() => idx.delete(KEY))
    .then(() => idx.get(KEY).then(res => assert.deepEqual([], res)));
  });

  it('should handle update by valid key', () => {
    const KEY = 'asaba';
    const VALUE = 'ABC';
    const NEW_VALUE = 'ABC123';
    return idx.put(KEY, VALUE)
    .then(() => idx.get(KEY))
    .then(res => assert.deepEqual([VALUE], res))

    .then(() => idx.update(KEY, NEW_VALUE))

    .then(() => idx.get(KEY))
    .then(res => assert.deepEqual([NEW_VALUE], res))
  });

  it('should handle update by unused key', () => {
    const KEY = 'asakrassa';
    const NEW_VALUE = 'KULBANA';
    return idx.get(KEY)
    .then(res => assert.deepEqual([], res))
    .then(() => idx.update(KEY, NEW_VALUE))
    .then(() => idx.get(KEY))
    .then(res => assert.deepEqual([NEW_VALUE],res));
  });


  it('should be able to reopen index and add new items', () => {
    const KEY1 = 'asaklint';
    const VAL1 = 'the beste no ';
    const ITERATIONS = 10;
    var tasks = [];
    for(var i = 0; i < ITERATIONS; ++i) {
      var tmpIdx = shIndex(INDEX_NAMESPACE);
      tasks.push(tmpIdx.put(KEY1, VAL1+i));
    }
    return Promise.all(tasks).then(() => {
      var tmpIdx = shIndex(INDEX_NAMESPACE);
      return tmpIdx.get(KEY1).then(res => assert.equal(ITERATIONS, res.length));
    });
  });

  describe('string unique', () => {
    const idx = shIndex(INDEX_NAMESPACE + '_unique',{ indexType: 'strings_unique'});

    it('should start empty', () => {
      return idx.clear().then(function() {
        return idx.size().then((sz) => assert.equal(0, sz));
      });
    });

    it('should filter put multiple times', () => {
      const KEY = 'asaba';
      const VALUE = 'ABC';
      const NEW_VALUE = 'ABC123';
      return idx.put(KEY, VALUE)
      .then(() => idx.put(KEY, VALUE))

      .then(() => idx.get(KEY))
      .then(res => assert.deepEqual([VALUE], res))

      .then(() => idx.put(KEY, NEW_VALUE))
      .then(() => idx.get(KEY))
      .then(res => assert.deepEqual([ NEW_VALUE, VALUE], res))
    });

    it('should handle quit', () => {
      return idx.put('asb', 'the beste1')
        .then(() => idx.quit())
        .then(() => idx.get('asb'))
        .then(assert.fail, assert.ok);
    });
  });

  describe('performance tests', () => {

    it('should handle put plenty items in single file', () => {
      var k = "D5320";
      const noOfItems = 1000;
      const tasks = [];
      times(noOfItems, function(n) {
        var v = (Math.random() * 10e20).toString(36);
        tasks.push(idx.put(k, v));
      });
      return Promise.all(tasks).then(() => {
        return idx.get(k)
        .then(res => assert.equal(noOfItems, res.length))
        .then(() => idx.search(k))
        .then(res => assert.equal(1, res.length));
      });
    });

    it('should distribute random data with multiple values on same key', () => {
      var noOfItems = 50;
      let PREV_KEY_LENGTH = 0;
      const tasks = [idx.size().then(res => PREV_KEY_LENGTH = res)];

      /* Fill with garbage **/
      times(noOfItems, function(n) {
        var k = (Math.random() * 10e20).toString(36).substring(0,random(2, 20));
        k += new Date().getTime();

        times(20, function(n) {
          var v = (Math.random() * 10e20).toString(36);
          tasks.push(idx.put(k, v));
        });
      });

      return Promise.all(tasks).then(() => {
        return idx.size().then(res => assert.equal(PREV_KEY_LENGTH + noOfItems, res));
      });
    });
  });

  describe('simultaneous read and write', () => {
    const idx2 = shIndex(INDEX_NAMESPACE);

    it('should be able to sync data between instances in same process', () => {
      const KEY = 'Netflix';
      const VALUE = 'The Crown';
      // Precond
      return idx.get(KEY)
      .then(res => assert.deepEqual([], res))
      .then(() => idx2.get(KEY))
      .then(res => assert.deepEqual([], res))
      // Change
      .then(() => idx.update(KEY, VALUE))
      // Post cond
      .then(() => idx.get(KEY))
      .then(res => assert.deepEqual([VALUE], res))
      .then(() => idx2.get(KEY))
      .then(res => assert.deepEqual([VALUE], res));
    });
  });
});

describe('Shatabang Object storage', () => {
  const OBJECT_INDEX_NAMESPACE = 'index_unit_test_objects';
  const objIndex = shIndex(OBJECT_INDEX_NAMESPACE, {indexType: 'object'});
  var objs = [{a: 1, b: 2}, {c: 3, d: 4}, {e: 5, f: 6}];

  it('should start empty', () => {
    return objIndex.clear().then(function() {
      return objIndex.size().then((sz) => assert.equal(0, sz));
    });
  });

  it('should be able to store objects', () => {
    var key = 123456789;
    return Promise.all(objs.map(async obj => {
      let itm = await objIndex.get('' + key)
      objIndex.put('' + (key++), obj);
    }));
  });

  it('should be able to list objects', () => {
    return objIndex.keys().then(async (keys) => {
      var promises = keys.sort().map(key => objIndex.get(key));
      let result = await Promise.all(promises);
      assert.deepStrictEqual(objs[0], result[0])
      assert.deepStrictEqual(objs[1], result[1])
      assert.deepStrictEqual(objs[2], result[2])
    })
    .catch(assert.fail);
  });
});