# @aneron/aoi-grid

Uniform grid index for two-dimensional points, keyed by entity id.

## Purpose

`@aneron/aoi-grid` tracks entities on a plane and answers which ids fall inside a radius. Insert, move, and remove entities by id. Query a point or another entity. Compare two query results to learn which ids came into view and which ids left. Cell size is chosen when the grid is created. Results depend only on the calls you make: there is no clock, no random source, and no network.

## Install

```bash
npm install @aneron/aoi-grid
```

The package is ESM, has no runtime dependencies, and runs on Node.js 20 and 22.

## Usage

```js
import { AoiGrid, diffView } from '@aneron/aoi-grid';

const grid = new AoiGrid({ cellSize: 32 });

grid.insert('alpha', 0, 0);
grid.insert('beta', 12, 0);
grid.insert('gamma', 80, 0);

const aroundOrigin = grid.queryRadius(0, 0, 16);
const aroundAlpha = grid.queryEntity('alpha', 16);

grid.move('gamma', 4, 0);
grid.remove('beta');

const before = grid.view('alpha', 16);

grid.insert('delta', 10, 10);
grid.move('gamma', 90, 0);

const after = grid.view('alpha', 16, before.ids);
const changes = diffView(before.ids, after.ids);
```

`aroundOrigin` is `['alpha', 'beta']`. `aroundAlpha` is `['beta']`, because a query around an entity omits that entity. `before.ids` is `['gamma']`. After `delta` is inserted and `gamma` moves away, `after.ids` is `['delta']`, `after.enter` is `['delta']`, and `after.leave` is `['gamma']`. `changes` has the same `enter` and `leave` arrays.

Keep the previous `ids` array and pass it into the next `view` or `viewAt` call. That pair of calls is the update.

## API

Ids are non-empty strings or finite numbers. `0` and `-0` are the same id. `0` and `'0'` are different. Coordinates are finite numbers. `-0` is stored as `0`.

Returned id arrays are sorted. Finite numbers come first, in numeric order, then strings in lexicographic order. `enter` and `leave` are sorted arrays that describe sets.

### `new AoiGrid(options)`

`options.cellSize` is a finite number greater than `0`, the width and height of each cell.

Throws `TypeError` when `options` is null, an array, or not an object. Throws `RangeError` when `cellSize` is missing or not a finite number greater than `0`.

### `cellSize`

The cell size passed to the constructor. Read only.

### `size`

How many entities are stored.

### `insert(id, x, y)`

Stores a new entity. Throws `TypeError` for an invalid id or coordinate, `RangeError` when a coordinate falls outside the supported range, and `Error` when the id is already present.

### `move(id, x, y)`

Changes the coordinates of an existing entity. Throws `TypeError` for an invalid id or coordinate, `RangeError` when a coordinate falls outside the supported range, and `Error` when the id is absent.

### `remove(id)`

Removes an existing entity. Throws `TypeError` for an invalid id and `Error` when the id is absent.

### `has(id)`

Returns whether the id is stored. Throws `TypeError` for an invalid id.

### `get(id)`

Returns `{ x, y }` for a stored entity, or `undefined` when the id is absent. The object is a copy. Throws `TypeError` for an invalid id.

### `queryRadius(x, y, radius)`

Returns the ids whose distance to `(x, y)` is less than or equal to `radius`. `radius` is a finite number greater than or equal to `0`.

Throws `TypeError` for invalid coordinates and `RangeError` for an invalid radius.

### `queryEntity(id, radius)`

Same distance test as `queryRadius`, centered on a stored entity. The entity itself is not included.

Throws `TypeError` for an invalid id, `RangeError` for an invalid radius, and `Error` when the id is absent.

### `view(id, radius, previous?)`

Builds the current nearby ids for an observer entity and compares them with `previous`. `previous` defaults to an empty list and may be any iterable of ids except a string. A `Set` or an array from the last result both work.

Returns `{ ids, enter, leave }`.

- `ids` are the entities currently inside the radius, excluding the observer.
- `enter` holds ids that are in `ids` and were not in `previous`.
- `leave` holds ids that were in `previous` and are not in `ids`.

The observer id is ignored if it appears in `previous`. Duplicate ids in `previous` are ignored.

Throws `TypeError` for an invalid id or `previous` value, `RangeError` for an invalid radius, and `Error` when the observer is absent.

### `viewAt(x, y, radius, previous?)`

Same as `view` for an observer that is a point rather than a stored entity.

Throws `TypeError` for invalid coordinates or `previous`, and `RangeError` for an invalid radius.

### `diffView(previous, next)`

Compares two iterables of ids. Returns `{ enter, leave }`. `enter` contains ids present only in `next`. `leave` contains ids present only in `previous`. Duplicates are ignored. Strings are not treated as lists of ids.

Throws `TypeError` when either argument is not an iterable of valid ids.

## Design

Each entity is stored in one cell. The column is `Math.floor(x / cellSize)` and the row is `Math.floor(y / cellSize)`. Floor division keeps negative coordinates stable. A value that lands on a boundary belongs to the cell toward positive infinity. With a cell size of 16, column 0 holds `0 <= x < 16`, column 1 starts at `x = 16`, and column -1 holds `-16 <= x < 0`.

A radius query visits the cells overlapped by the circle's bounding box, then keeps ids whose squared distance is less than or equal to `radius * radius`. Touching the box is not enough: a corner of a visited cell can sit outside the circle and is rejected. When that box covers far more cells than the grid currently occupies, the query tests every stored entity with the same distance rule.

`enter` and `leave` are the set difference of the previous id list and the current one. The grid does not remember observers. Nothing is scheduled, sampled at random, or loaded over the network. The same sequence of calls produces the same arrays.

Coordinates must map to a safe integer cell index. Values so large that the cell index is not a safe integer are rejected on insert and move. A query that cannot name its cells falls back to a direct scan.

## License

MIT. Copyright (c) 2026 Vadim Gubin.
