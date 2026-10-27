export class AoiGrid {
  #cellSize;
  #entities = new Map();
  #columns = new Map();
  #occupied = 0;

  constructor(options) {
    if (
      options === null ||
      typeof options !== 'object' ||
      Array.isArray(options)
    ) {
      throw new TypeError('options must be an object');
    }
    const { cellSize } = options;
    if (
      typeof cellSize !== 'number' ||
      !Number.isFinite(cellSize) ||
      cellSize <= 0
    ) {
      throw new RangeError('cellSize must be a finite number greater than 0');
    }
    this.#cellSize = cellSize;
  }

  get cellSize() {
    return this.#cellSize;
  }

  get size() {
    return this.#entities.size;
  }

  has(id) {
    id = assertId(id);
    return this.#entities.has(id);
  }

  get(id) {
    id = assertId(id);
    const entity = this.#entities.get(id);
    if (!entity) {
      return undefined;
    }
    return { x: entity.x, y: entity.y };
  }

  insert(id, x, y) {
    id = assertId(id);
    const point = assertPoint(x, y);
    if (this.#entities.has(id)) {
      throw new Error(`entity already exists: ${String(id)}`);
    }
    const cx = requireCell(point.x, this.#cellSize);
    const cy = requireCell(point.y, this.#cellSize);
    this.#entities.set(id, { x: point.x, y: point.y, cx, cy });
    this.#link(id, cx, cy);
  }

  move(id, x, y) {
    id = assertId(id);
    const point = assertPoint(x, y);
    const entity = this.#require(id);
    const cx = requireCell(point.x, this.#cellSize);
    const cy = requireCell(point.y, this.#cellSize);
    entity.x = point.x;
    entity.y = point.y;
    if (entity.cx === cx && entity.cy === cy) {
      return;
    }
    this.#unlink(id, entity.cx, entity.cy);
    entity.cx = cx;
    entity.cy = cy;
    this.#link(id, cx, cy);
  }

  remove(id) {
    id = assertId(id);
    const entity = this.#require(id);
    this.#unlink(id, entity.cx, entity.cy);
    this.#entities.delete(id);
  }

  queryRadius(x, y, radius) {
    const point = assertPoint(x, y);
    assertRadius(radius);
    return this.#collect(point.x, point.y, radius, undefined);
  }

  queryEntity(id, radius) {
    id = assertId(id);
    assertRadius(radius);
    const entity = this.#require(id);
    return this.#collect(entity.x, entity.y, radius, id);
  }

  view(id, radius, previous = []) {
    id = assertId(id);
    assertRadius(radius);
    const seen = readIds(previous, 'previous');
    seen.delete(id);
    const entity = this.#require(id);
    const ids = this.#collect(entity.x, entity.y, radius, id);
    return { ids, ...difference(seen, new Set(ids)) };
  }

  viewAt(x, y, radius, previous = []) {
    const point = assertPoint(x, y);
    assertRadius(radius);
    const seen = readIds(previous, 'previous');
    const ids = this.#collect(point.x, point.y, radius, undefined);
    return { ids, ...difference(seen, new Set(ids)) };
  }

  #require(id) {
    const entity = this.#entities.get(id);
    if (!entity) {
      throw new Error(`entity not found: ${String(id)}`);
    }
    return entity;
  }

  #link(id, cx, cy) {
    let column = this.#columns.get(cx);
    if (!column) {
      column = new Map();
      this.#columns.set(cx, column);
    }
    let bucket = column.get(cy);
    if (!bucket) {
      bucket = new Set();
      column.set(cy, bucket);
      this.#occupied += 1;
    }
    bucket.add(id);
  }

  #unlink(id, cx, cy) {
    const column = this.#columns.get(cx);
    const bucket = column.get(cy);
    bucket.delete(id);
    if (bucket.size === 0) {
      column.delete(cy);
      this.#occupied -= 1;
      if (column.size === 0) {
        this.#columns.delete(cx);
      }
    }
  }

  #collect(x, y, radius, skipId) {
    const found = [];
    const bounds = this.#bounds(x, y, radius);
    if (bounds) {
      for (let cx = bounds.minX; cx <= bounds.maxX; cx += 1) {
        const column = this.#columns.get(cx);
        if (!column) {
          continue;
        }
        for (let cy = bounds.minY; cy <= bounds.maxY; cy += 1) {
          const bucket = column.get(cy);
          if (!bucket) {
            continue;
          }
          for (const id of bucket) {
            this.#consider(found, id, x, y, radius, skipId);
          }
        }
      }
    } else {
      for (const [id, entity] of this.#entities) {
        if (id !== skipId && within(x, y, entity.x, entity.y, radius)) {
          found.push(id);
        }
      }
    }
    found.sort(compareIds);
    return found;
  }

  #consider(found, id, x, y, radius, skipId) {
    if (id === skipId) {
      return;
    }
    const entity = this.#entities.get(id);
    if (within(x, y, entity.x, entity.y, radius)) {
      found.push(id);
    }
  }

  #bounds(x, y, radius) {
    const minX = cellIndex(x - radius, this.#cellSize);
    const maxX = cellIndex(x + radius, this.#cellSize);
    const minY = cellIndex(y - radius, this.#cellSize);
    const maxY = cellIndex(y + radius, this.#cellSize);
    if (minX === null || maxX === null || minY === null || maxY === null) {
      return null;
    }
    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    if (
      !Number.isSafeInteger(spanX) ||
      !Number.isSafeInteger(spanY) ||
      spanX * spanY > this.#occupied * 4 + 32
    ) {
      return null;
    }
    return { minX, maxX, minY, maxY };
  }
}

export function diffView(previous, next) {
  return difference(readIds(previous, 'previous'), readIds(next, 'next'));
}

function difference(previous, next) {
  const enter = [];
  const leave = [];
  for (const id of next) {
    if (!previous.has(id)) {
      enter.push(id);
    }
  }
  for (const id of previous) {
    if (!next.has(id)) {
      leave.push(id);
    }
  }
  enter.sort(compareIds);
  leave.sort(compareIds);
  return { enter, leave };
}

function readIds(value, label) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value[Symbol.iterator] !== 'function'
  ) {
    throw new TypeError(`${label} must be an iterable of ids`);
  }
  const ids = new Set();
  for (const id of value) {
    ids.add(assertId(id));
  }
  return ids;
}

function assertId(id) {
  if (typeof id === 'number' && id === 0) {
    return 0;
  }
  if (typeof id === 'string') {
    if (id.length === 0) {
      throw new TypeError('id must be a non-empty string or a finite number');
    }
    return id;
  }
  if (typeof id === 'number' && Number.isFinite(id)) {
    return id;
  }
  throw new TypeError('id must be a non-empty string or a finite number');
}

function assertPoint(x, y) {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    throw new TypeError('x and y must be finite numbers');
  }
  return {
    x: x === 0 ? 0 : x,
    y: y === 0 ? 0 : y,
  };
}

function assertRadius(radius) {
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0) {
    throw new RangeError(
      'radius must be a finite number greater than or equal to 0',
    );
  }
}

function requireCell(value, cellSize) {
  const index = cellIndex(value, cellSize);
  if (index === null) {
    throw new RangeError('coordinates are outside the supported range');
  }
  return index;
}

function cellIndex(value, cellSize) {
  const index = Math.floor(value / cellSize);
  if (!Number.isSafeInteger(index)) {
    return null;
  }
  return index;
}

function within(x0, y0, x1, y1, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy <= radius * radius;
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
