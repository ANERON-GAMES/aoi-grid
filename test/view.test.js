import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AoiGrid, diffView } from '../src/index.js';

function createGrid(cellSize, entries = []) {
  const grid = new AoiGrid({ cellSize });
  for (const [id, x, y] of entries) {
    grid.insert(id, x, y);
  }
  return grid;
}

describe('enter and leave sets', () => {
  it('reports who came into view and who left between two updates', () => {
    const grid = createGrid(16, [
      ['observer', 0, 0],
      ['near', 10, 0],
      ['edge', 30, 0],
      ['far', 100, 0],
    ]);

    const first = grid.view('observer', 30);
    assert.deepEqual(first.ids, ['edge', 'near']);
    assert.deepEqual(first.enter, ['edge', 'near']);
    assert.deepEqual(first.leave, []);

    grid.move('far', 5, 0);
    grid.move('near', 40, 0);
    grid.move('edge', 20, 0);
    grid.insert('fresh', 0, 10);

    const second = grid.view('observer', 30, first.ids);
    assert.deepEqual(second.ids, ['edge', 'far', 'fresh']);
    assert.deepEqual(second.enter, ['far', 'fresh']);
    assert.deepEqual(second.leave, ['near']);
    assert.deepEqual(diffView(first.ids, second.ids), {
      enter: ['far', 'fresh'],
      leave: ['near'],
    });
  });

  it('updates when the observer entity moves', () => {
    const grid = createGrid(20, [
      ['observer', 0, 0],
      ['left', -8, 0],
      ['right', 40, 0],
    ]);
    const first = grid.view('observer', 10);
    assert.deepEqual(first.ids, ['left']);

    grid.move('observer', 40, 0);
    const second = grid.view('observer', 10, first.ids);
    assert.deepEqual(second.ids, ['right']);
    assert.deepEqual(second.enter, ['right']);
    assert.deepEqual(second.leave, ['left']);
  });

  it('updates when the observer is a point', () => {
    const grid = createGrid(15, [
      ['a', 0, 0],
      ['b', 50, 0],
      ['c', 3, 4],
    ]);
    const first = grid.viewAt(0, 0, 5);
    assert.deepEqual(first.ids, ['a', 'c']);
    assert.deepEqual(first.enter, ['a', 'c']);

    grid.remove('c');
    grid.insert('d', 50, 1);
    const second = grid.viewAt(50, 0, 5, first.ids);
    assert.deepEqual(second.ids, ['b', 'd']);
    assert.deepEqual(second.enter, ['b', 'd']);
    assert.deepEqual(second.leave, ['a', 'c']);
  });

  it('keeps ids that stay and ignores duplicates', () => {
    const grid = createGrid(8, [
      ['observer', 0, 0],
      ['stay', 1, 1],
      ['go', 2, 0],
    ]);
    const previous = ['go', 'stay', 'stay', 'go'];
    grid.move('go', 30, 0);
    const seen = grid.view('observer', 5, previous);
    assert.deepEqual(seen.ids, ['stay']);
    assert.deepEqual(seen.enter, []);
    assert.deepEqual(seen.leave, ['go']);
    assert.deepEqual(diffView(previous, seen.ids), {
      enter: [],
      leave: ['go'],
    });
  });

  it('does not put the observer in either set', () => {
    const grid = createGrid(8, [
      ['observer', 0, 0],
      ['other', 1, 0],
    ]);
    const seen = grid.view('observer', 5, ['observer', 'ghost']);
    assert.deepEqual(seen.ids, ['other']);
    assert.deepEqual(seen.enter, ['other']);
    assert.deepEqual(seen.leave, ['ghost']);
    assert.equal(seen.ids.includes('observer'), false);
  });

  it('sorts enter and leave for mixed id types', () => {
    const previous = ['m', 3, 'a'];
    const next = new Set([1, 'b', 3]);
    assert.deepEqual(diffView(previous, next), {
      enter: [1, 'b'],
      leave: ['a', 'm'],
    });
    assert.deepEqual(diffView([], []), { enter: [], leave: [] });
    assert.deepEqual(diffView(['a'], ['a']), { enter: [], leave: [] });
  });

  it('does not mutate the previous iterable', () => {
    const grid = createGrid(8, [
      ['observer', 0, 0],
      ['a', 1, 0],
    ]);
    const previous = ['a', 'b'];
    grid.view('observer', 4, previous);
    assert.deepEqual(previous, ['a', 'b']);
  });

  it('matches set difference after a chain of updates', () => {
    const grid = createGrid(10, [
      ['observer', -5, -5],
      ['a', -4, -4],
      ['b', 20, 0],
      ['c', -30, 10],
    ]);
    let previous = [];
    const snapshots = [];
    const mutations = [
      () => grid.move('b', -5, -6),
      () => grid.move('observer', 20, 0),
      () => grid.remove('a'),
      () => grid.insert('d', 21, 1),
      () => grid.move('c', 20, 2),
      () => grid.move('observer', -30, 10),
    ];
    for (const mutate of mutations) {
      mutate();
      const seen = grid.view('observer', 8, previous);
      const current = grid.queryEntity('observer', 8);
      assert.deepEqual(seen.ids, current);
      assert.deepEqual(seen, {
        ids: current,
        ...diffView(previous, current),
      });
      snapshots.push(seen);
      previous = seen.ids;
    }
    assert.equal(snapshots.length, mutations.length);
  });
});
