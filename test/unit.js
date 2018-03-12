var assert = require('assert');
var shIndex = require('../index.js');

const INDEX_NAMESPACE = 'index_unit_test';

function random(from, to) {
  return from + Math.floor(Math.random() * (to-from));
}

function times(count, func) {
  for(var i = 0; i < count; ++i) {
    func();
  }
}

describe('Shatabang Index', function() {
  // Connects to the default instance
  const idx = shIndex(INDEX_NAMESPACE,{});

  it('should start empty', function() {
    return idx.clear().then(function() {
      return idx.size().then((sz) => assert.equal(0, sz));
    });
  });

  it('get should return empty array for unknown key', function() {
    return idx.get('aaa').then(val => assert.deepEqual([], val));
  });

  it('search should return empty array for unknown key', function() {
    return idx.search('aaa').then(val => assert.deepEqual([], val));
  });

  it('get should reject if key is not string', function() {
    return idx.get(12).then(assert.fail, assert.ok);
  });

  it('put should reject if key is not string', function() {
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
    const KEY = '*$HDv>J7{$}s&N*+Gm=sZ@+9E!WL)!ZhT)?SofkHM^{YKE&FTADDFRErY%YDvfprAd-)[DWp6/u$9+@zFJ%1xLq{gBz+/cx(4D]H<ixour7fiuT[.AHJcZgurQAf';
    const VAL1 = 'val1';
    return idx.put(KEY, VAL1).then(function() {
      return idx.get(KEY).then(res => assert.deepEqual([VAL1], res));
    });
  });

  it('should not allow colon in the key', () => {
    const KEY = 'abc:def';
    const VAL1 = 'val1';
    return idx.put(KEY, VAL1).then(assert.fail, assert.ok);
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


  it('should be able to reopen index and add new items', function() {
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

  it('should handle put plenty items in single file', () => {
    var k = "D5320";
    const noOfItems = 10000;
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

      times(200, function(n) {
        var v = (Math.random() * 10e20).toString(36);
        tasks.push(idx.put(k, v));
      });
    });

    return Promise.all(tasks).then(() => {
      return idx.size().then(res => assert.equal(PREV_KEY_LENGTH + noOfItems, res));
    });
  });

  describe('simultaneous read and write', function() {
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
