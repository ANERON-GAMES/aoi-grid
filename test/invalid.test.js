import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AoiGrid, diffView } from '../src/index.js';

const idMessage = 'id must be a non-empty string or a finite number';
const pointMessage = 'x and y must be finite numbers';
const radiusMessage =
  'radius must be a finite number greater than or equal to 0';
const cellMessage = 'cellSize must be a finite number greater than 0';

describe('invalid input', () => {
  it('rejects a bad constructor argument', () => {
    assert.throws(() => new AoiGrid(), /options must be an object/);
    assert.throws(() => new AoiGrid(null), /options must be an object/);
    assert.throws(() => new AoiGrid(10), /options must be an object/);
    assert.throws(() => new AoiGrid([10]), /options must be an object/);
    assert.throws(() => new AoiGrid({}), {
      name: 'RangeError',
      message: cellMessage,
    });
    for (const cellSize of [
      0,
      -1,
      -0.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      '8',
      true,
    ]) {
      assert.throws(() => new AoiGrid({ cellSize }), {
        name: 'RangeError',
        message: cellMessage,
      });
    }
  });

  it('rejects bad ids and coordinates', () => {
    const grid = new AoiGrid({ cellSize: 4 });
    const badIds = [
      '',
      null,
      undefined,
      true,
      false,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      {},
      [],
      Symbol('id'),
    ];
    for (const id of badIds) {
      assert.throws(() => grid.insert(id, 0, 0), {
        name: 'TypeError',
        message: idMessage,
      });
      assert.throws(() => grid.move(id, 0, 0), {
        name: 'TypeError',
        message: idMessage,
      });
      assert.throws(() => grid.remove(id), {
        name: 'TypeError',
        message: idMessage,
      });
      assert.throws(() => grid.has(id), {
        name: 'TypeError',
        message: idMessage,
      });
      assert.throws(() => grid.get(id), {
        name: 'TypeError',
        message: idMessage,
      });
      assert.throws(() => grid.queryEntity(id, 1), {
        name: 'TypeError',
        message: idMessage,
      });
      assert.throws(() => grid.view(id, 1), {
        name: 'TypeError',
        message: idMessage,
      });
    }

    const badPoints = [
      [Number.NaN, 0],
      [0, Number.NaN],
      [Number.POSITIVE_INFINITY, 0],
      [0, Number.NEGATIVE_INFINITY],
      ['0', 0],
      [0, '0'],
      [undefined, 0],
      [0, null],
    ];
    for (const [x, y] of badPoints) {
      assert.throws(() => grid.insert('a', x, y), {
        name: 'TypeError',
        message: pointMessage,
      });
      assert.throws(() => grid.queryRadius(x, y, 1), {
        name: 'TypeError',
        message: pointMessage,
      });
      assert.throws(() => grid.viewAt(x, y, 1), {
        name: 'TypeError',
        message: pointMessage,
      });
    }

    grid.insert('a', 0, 0);
    assert.throws(() => grid.move('a', Number.NaN, 0), {
      name: 'TypeError',
      message: pointMessage,
    });
    assert.throws(() => grid.move('missing', Number.NaN, 0), {
      name: 'TypeError',
      message: pointMessage,
    });
    assert.deepEqual(grid.get('a'), { x: 0, y: 0 });
  });

  it('rejects a bad radius', () => {
    const grid = new AoiGrid({ cellSize: 4 });
    grid.insert('a', 0, 0);
    for (const radius of [
      -1,
      -0.01,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      '1',
      null,
    ]) {
      assert.throws(() => grid.queryRadius(0, 0, radius), {
        name: 'RangeError',
        message: radiusMessage,
      });
      assert.throws(() => grid.queryEntity('a', radius), {
        name: 'RangeError',
        message: radiusMessage,
      });
      assert.throws(() => grid.view('a', radius), {
        name: 'RangeError',
        message: radiusMessage,
      });
      assert.throws(() => grid.viewAt(0, 0, radius), {
        name: 'RangeError',
        message: radiusMessage,
      });
    }
  });

  it('rejects coordinates outside the safe cell range', () => {
    const grid = new AoiGrid({ cellSize: 1 });
    assert.throws(() => grid.insert('a', Number.MAX_VALUE, 0), {
      name: 'RangeError',
      message: 'coordinates are outside the supported range',
    });
    assert.throws(() => grid.insert('a', 0, -Number.MAX_VALUE), {
      name: 'RangeError',
      message: 'coordinates are outside the supported range',
    });
    grid.insert('a', 0, 0);
    assert.throws(() => grid.move('a', Number.MAX_VALUE, 1), {
      name: 'RangeError',
      message: 'coordinates are outside the supported range',
    });
    assert.deepEqual(grid.get('a'), { x: 0, y: 0 });
    assert.deepEqual(grid.queryRadius(0, 0, 0), ['a']);
  });

  it('rejects a previous or next value that is not an iterable of ids', () => {
    const grid = new AoiGrid({ cellSize: 4 });
    grid.insert('a', 0, 0);
    for (const value of [null, 'ab', 1, true, {}]) {
      assert.throws(() => grid.view('a', 1, value), {
        name: 'TypeError',
        message: 'previous must be an iterable of ids',
      });
      assert.throws(() => grid.viewAt(0, 0, 1, value), {
        name: 'TypeError',
        message: 'previous must be an iterable of ids',
      });
      assert.throws(() => diffView(value, []), {
        name: 'TypeError',
        message: 'previous must be an iterable of ids',
      });
      assert.throws(() => diffView([], value), {
        name: 'TypeError',
        message: 'next must be an iterable of ids',
      });
    }
    assert.throws(() => diffView(undefined, []), {
      name: 'TypeError',
      message: 'previous must be an iterable of ids',
    });
    assert.deepEqual(grid.view('a', 1, undefined), {
      ids: [],
      enter: [],
      leave: [],
    });
    assert.throws(() => diffView(['ok', ''], ['ok']), {
      name: 'TypeError',
      message: idMessage,
    });
    assert.throws(() => diffView(['ok'], [null]), {
      name: 'TypeError',
      message: idMessage,
    });
    assert.throws(() => grid.view('a', 1, ['ok', {}]), {
      name: 'TypeError',
      message: idMessage,
    });
    assert.throws(() => grid.view('missing', 1, null), {
      name: 'TypeError',
      message: 'previous must be an iterable of ids',
    });
  });

  it('leaves the grid unchanged after a rejected call', () => {
    const grid = new AoiGrid({ cellSize: 5 });
    grid.insert('a', 1, 2);
    assert.throws(() => grid.insert('a', 9, 9));
    assert.throws(() => grid.insert('b', Number.NaN, 0));
    assert.throws(() => grid.move('a', Number.POSITIVE_INFINITY, 0));
    assert.throws(() => grid.remove('missing'));
    assert.equal(grid.size, 1);
    assert.deepEqual(grid.get('a'), { x: 1, y: 2 });
    assert.deepEqual(grid.queryRadius(1, 2, 0), ['a']);
  });
});
