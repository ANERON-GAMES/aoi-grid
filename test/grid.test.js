import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AoiGrid } from '../src/index.js';

function createGrid(cellSize, entries = []) {
  const grid = new AoiGrid({ cellSize });
  for (const [id, x, y] of entries) {
    grid.insert(id, x, y);
  }
  return grid;
}

function compareIds(a, b) {
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) {
    return typeA < typeB ? -1 : 1;
  }
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function brute(entries, x, y, radius, skipId) {
  const limit = radius * radius;
  const ids = [];
  for (const [id, ex, ey] of entries) {
    if (id === skipId) {
      continue;
    }
    const dx = ex - x;
    const dy = ey - y;
    if (dx * dx + dy * dy <= limit) {
      ids.push(id);
    }
  }
  ids.sort(compareIds);
  return ids;
}

describe('insert, move, and remove', () => {
  it('stores, updates, and drops entities by id', () => {
    const grid = new AoiGrid({ cellSize: 16 });
    assert.equal(grid.size, 0);
    assert.equal(grid.cellSize, 16);

    grid.insert('a', 1, 2);
    grid.insert(7, -3, 4);
    assert.equal(grid.size, 2);
    assert.equal(grid.has('a'), true);
    assert.equal(grid.has(7), true);
    assert.equal(grid.has('missing'), false);
    assert.deepEqual(grid.get('a'), { x: 1, y: 2 });
    assert.deepEqual(grid.get(7), { x: -3, y: 4 });
    assert.equal(grid.get('missing'), undefined);

    const copy = grid.get('a');
    copy.x = 99;
    assert.deepEqual(grid.get('a'), { x: 1, y: 2 });

    grid.move('a', 20, -6);
    assert.deepEqual(grid.get('a'), { x: 20, y: -6 });
    grid.move(7, 7, 7);
    assert.deepEqual(grid.get(7), { x: 7, y: 7 });

    grid.remove('a');
    assert.equal(grid.has('a'), false);
    assert.equal(grid.get('a'), undefined);
    assert.equal(grid.size, 1);
    grid.insert('a', 0, 0);
    assert.deepEqual(grid.get('a'), { x: 0, y: 0 });

    grid.remove(7);
    grid.remove('a');
    assert.equal(grid.size, 0);
  });

  it('treats zero and negative zero as the same id and coordinate', () => {
    const grid = new AoiGrid({ cellSize: 8 });
    grid.insert(-0, -0, -0);
    assert.equal(grid.size, 1);
    assert.equal(grid.has(0), true);
    assert.equal(grid.has(-0), true);
    const position = grid.get(0);
    assert.equal(Object.is(position.x, 0), true);
    assert.equal(Object.is(position.y, 0), true);
    assert.throws(() => grid.insert(0, 1, 1), /entity already exists: 0/);
    grid.move(-0, 3, -0);
    assert.deepEqual(grid.get(0), { x: 3, y: 0 });
  });

  it('keeps string and numeric ids distinct and sorts them', () => {
    const grid = createGrid(10, [
      ['10', 0, 0],
      [2, 0, 0],
      ['a', 0, 0],
      [-4, 0, 0],
      [10, 0, 0],
    ]);
    assert.deepEqual(grid.queryRadius(0, 0, 0), [-4, 2, 10, '10', 'a']);
  });

  it('updates position inside a cell and across cells', () => {
    const grid = createGrid(32, [
      ['near', 1, 0],
      ['other', 100, 100],
    ]);
    assert.deepEqual(grid.queryRadius(0, 0, 5), ['near']);
    grid.move('near', 10, 0);
    assert.deepEqual(grid.queryRadius(0, 0, 5), []);
    assert.deepEqual(grid.queryRadius(10, 0, 0), ['near']);

    grid.move('near', -40, 3);
    assert.deepEqual(grid.queryRadius(10, 0, 0), []);
    assert.deepEqual(grid.queryRadius(-40, 3, 0), ['near']);
    grid.remove('near');
    assert.deepEqual(grid.queryRadius(-40, 3, 1), []);
    assert.deepEqual(grid.queryEntity('other', 1), []);
  });

  it('allows another entity to occupy a cell after the last one leaves', () => {
    const grid = createGrid(8, [['a', 1, 1]]);
    grid.remove('a');
    grid.insert('b', 1, 1);
    grid.insert('c', 20, 1);
    grid.move('c', 2, 2);
    assert.deepEqual(grid.queryRadius(1, 1, 2), ['b', 'c']);
  });

  it('rejects a second insert and a missing move or remove', () => {
    const grid = createGrid(4, [['a', 0, 0]]);
    assert.throws(() => grid.insert('a', 1, 1), {
      name: 'Error',
      message: 'entity already exists: a',
    });
    assert.throws(() => grid.move('b', 1, 1), {
      name: 'Error',
      message: 'entity not found: b',
    });
    assert.throws(() => grid.remove('b'), {
      name: 'Error',
      message: 'entity not found: b',
    });
    assert.throws(() => grid.queryEntity('b', 1), {
      name: 'Error',
      message: 'entity not found: b',
    });
    grid.remove('a');
    assert.throws(() => grid.remove('a'), /entity not found: a/);
  });
});

describe('radius edges', () => {
  it('includes an entity on the radius and excludes one just outside', () => {
    const grid = createGrid(10, [
      ['triple', 3, 4],
      ['inside', 6, 8],
      ['outside', 6.5, 8],
      ['west', -5, 0],
      ['past', -5.25, 0],
      ['self', 0, 0],
    ]);
    assert.deepEqual(grid.queryRadius(0, 0, 5), ['self', 'triple', 'west']);
    assert.deepEqual(grid.queryRadius(0, 0, 10), [
      'inside',
      'past',
      'self',
      'triple',
      'west',
    ]);
    assert.equal(grid.queryRadius(0, 0, 10).includes('outside'), false);
    assert.equal(grid.queryRadius(0, 0, 5).includes('past'), false);
    assert.equal(grid.queryRadius(0, 0, 5.25).includes('past'), true);
    assert.deepEqual(grid.queryEntity('self', 5), ['triple', 'west']);
    assert.deepEqual(grid.queryEntity('self', 0), []);
  });

  it('uses a closed radius of zero', () => {
    const grid = createGrid(4, [
      ['origin', 0, 0],
      ['also', 0, 0],
      ['off', 0, 0.5],
    ]);
    assert.deepEqual(grid.queryRadius(0, 0, 0), ['also', 'origin']);
    assert.deepEqual(grid.queryEntity('origin', 0), ['also']);
    assert.deepEqual(grid.queryRadius(0, 0.5, 0), ['off']);
  });

  it('matches a direct distance test for every cell size', () => {
    const samples = [
      ['n2', -20, -5],
      ['n1', -16, 0],
      ['n0', -8, 8],
      ['z', 0, 0],
      ['p1', 8, -8],
      ['p2', 16, 16],
      ['edge', 32, -16],
      ['frac', 4.5, -4.5],
      [2, 12, 0],
      [10, -12, 7.5],
      ['s', 0.5, 0.5],
    ];
    const centers = [
      [0, 0],
      [16, 16],
      [-16, -16],
      [8, 0],
      [-8, 4.5],
      [32, -16],
      [1, -1],
    ];
    const radii = [0, 0.5, 4, 8, 12.5, 20, 100];
    const cellSizes = [0.5, 1, 8, 10.5, 16, 32, 64];

    for (const cellSize of cellSizes) {
      const grid = createGrid(cellSize, samples);
      for (const [x, y] of centers) {
        for (const radius of radii) {
          assert.deepEqual(
            grid.queryRadius(x, y, radius),
            brute(samples, x, y, radius),
          );
          assert.deepEqual(
            grid.queryEntity('z', radius),
            brute(samples, 0, 0, radius, 'z'),
          );
        }
      }
    }
  });

  it('scans instead of walking a huge cell range', { timeout: 2000 }, () => {
    const samples = [
      ['a', -2, 3],
      ['b', 40, -1],
      ['c', 8, 8],
    ];
    const grid = createGrid(1, samples);
    assert.deepEqual(grid.queryRadius(0, 0, 1e6), brute(samples, 0, 0, 1e6));
    assert.deepEqual(
      grid.queryEntity('b', 1e6),
      brute(samples, 40, -1, 1e6, 'b'),
    );
  });
});

describe('cell boundaries', () => {
  it('finds entities that sit on a positive boundary', () => {
    const cellSize = 16;
    const grid = createGrid(cellSize, [
      ['on', cellSize, 0],
      ['before', cellSize - 0.5, 0],
      ['corner', cellSize, cellSize],
    ]);
    assert.deepEqual(grid.queryRadius(0, 0, cellSize), ['before', 'on']);
    assert.deepEqual(grid.queryRadius(0, 0, cellSize - 0.5), ['before']);
    assert.deepEqual(grid.queryRadius(cellSize * 2, 0, cellSize), ['on']);
    assert.deepEqual(grid.queryRadius(cellSize * 2, 0, cellSize - 1), []);
    assert.deepEqual(grid.queryRadius(0, 0, 22), ['before', 'on']);
    assert.equal(grid.queryRadius(0, 0, 22).includes('corner'), false);
    assert.deepEqual(grid.queryRadius(0, 0, 32), ['before', 'corner', 'on']);
  });

  it('finds entities that sit on a negative boundary', () => {
    const cellSize = 16;
    const grid = createGrid(cellSize, [
      ['on', -cellSize, 0],
      ['before', -cellSize - 0.5, 0],
      ['after', -cellSize + 0.5, 0],
    ]);
    assert.deepEqual(grid.queryRadius(0, 0, cellSize), ['after', 'on']);
    assert.deepEqual(grid.queryRadius(0, 0, cellSize - 0.5), ['after']);
    assert.deepEqual(grid.queryRadius(-cellSize * 2, 0, cellSize), [
      'before',
      'on',
    ]);
    assert.deepEqual(grid.queryRadius(-cellSize * 2, 0, cellSize - 0.5), [
      'before',
    ]);
  });

  it('rejects an entity whose cell meets the box but whose distance does not', () => {
    const grid = createGrid(10, [['corner', 10, 10]]);
    assert.deepEqual(grid.queryRadius(0, 0, 10), []);
    assert.deepEqual(grid.queryRadius(0, 0, 14), []);
    assert.deepEqual(grid.queryRadius(0, 0, 15), ['corner']);
  });

  it('follows a scripted series of moves across boundaries', () => {
    const cellSize = 8;
    let entries = [
      ['a', 0, 0],
      ['b', 8, -8],
      ['c', -8, 4],
    ];
    const grid = createGrid(cellSize, entries);
    const steps = [
      ['move', 'a', 8, 0],
      ['move', 'b', -16, -0],
      ['move', 'c', 7.5, -0.5],
      ['remove', 'b'],
      ['insert', 'b', -8, -8],
      ['move', 'a', -0, 8],
      ['move', 'c', 24, 8],
      ['remove', 'a'],
      ['insert', 'd', 8, 8],
    ];
    const centers = [
      [0, 0],
      [8, 8],
      [-8, -8],
      [7.5, -0.5],
    ];
    const radii = [0, 4, 8, 12];

    function apply(kind, id, x, y) {
      if (kind === 'insert') {
        entries.push([id, x, y]);
        grid.insert(id, x, y);
        return;
      }
      if (kind === 'remove') {
        entries = entries.filter((entry) => entry[0] !== id);
        grid.remove(id);
        return;
      }
      entries = entries.map((entry) => (entry[0] === id ? [id, x, y] : entry));
      grid.move(id, x, y);
    }

    for (const step of steps) {
      apply(...step);
      for (const [x, y] of centers) {
        for (const radius of radii) {
          assert.deepEqual(
            grid.queryRadius(x, y, radius),
            brute(entries, x, y, radius),
          );
        }
      }
    }
  });
});

describe('negative coordinates', () => {
  it('queries entities that live only in the negative quadrant', () => {
    const grid = createGrid(12, [
      ['a', -3, -4],
      ['b', -30, -40],
      ['c', -9, 2],
    ]);
    assert.deepEqual(grid.queryRadius(-3, -4, 5), ['a']);
    assert.deepEqual(grid.queryRadius(0, 0, 10), ['a', 'c']);
    assert.deepEqual(grid.queryEntity('b', 1), []);
    assert.deepEqual(grid.queryEntity('a', 100), ['b', 'c']);
  });

  it('moves an entity from a negative cell into a positive cell', () => {
    const grid = createGrid(10, [['a', -15, -1]]);
    assert.deepEqual(grid.queryRadius(-15, -1, 0), ['a']);
    assert.deepEqual(grid.queryRadius(4, 6, 1), []);
    grid.move('a', 4, 6);
    assert.deepEqual(grid.queryRadius(-15, -1, 0), []);
    assert.deepEqual(grid.queryRadius(4, 6, 0), ['a']);
    grid.move('a', -10, -10);
    assert.deepEqual(grid.queryRadius(0, 0, 14), []);
    assert.deepEqual(grid.queryRadius(0, 0, 15), ['a']);
  });

  it('accepts large finite coordinates that still have a safe cell index', () => {
    const grid = new AoiGrid({ cellSize: 10 });
    grid.insert('far', 1e12, -1e12);
    assert.deepEqual(grid.get('far'), { x: 1e12, y: -1e12 });
    assert.deepEqual(grid.queryRadius(1e12, -1e12, 0), ['far']);
    assert.deepEqual(grid.queryRadius(0, 0, 10), []);
  });
});
