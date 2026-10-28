import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
    } else if (entry.endsWith('.js')) {
      files.push(path);
    }
  }
  return files;
}

function hasComment(source) {
  let quote = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && (next === '/' || next === '*')) {
      return true;
    }
  }
  return false;
}

describe('package surface', () => {
  it('exports the grid and the view diff', () => {
    assert.deepEqual(Object.keys(api).sort(), ['AoiGrid', 'diffView']);
  });

  it('keeps the package public metadata', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.name, '@aneron/aoi-grid');
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.author, 'Vadim Gubin');
    assert.equal(pkg.license, 'MIT');
    assert.equal(pkg.engines.node, '>=20');
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.exports['.'], './src/index.js');
  });

  it('uses the required license line', () => {
    const lines = read('LICENSE').split('\n');
    assert.equal(lines.includes('Copyright (c) 2026 Vadim Gubin'), true);
  });

  it('documents the required sections', () => {
    const readme = read('README.md');
    for (const heading of [
      '## Purpose',
      '## Install',
      '## Usage',
      '## API',
      '## Design',
      '## License',
    ]) {
      assert.equal(readme.includes(heading), true);
    }
    assert.equal(readme.includes('MIT. Copyright (c) 2026 Vadim Gubin.'), true);
  });

  it('runs lint, format check, and tests on Node 20 and 22', () => {
    const ci = read('.github/workflows/ci.yml');
    assert.equal(ci.includes('push:'), true);
    assert.equal(ci.includes('pull_request:'), true);
    assert.equal(ci.includes('node-version: [20, 22]'), true);
    assert.equal(ci.includes('npm run lint'), true);
    assert.equal(ci.includes('npm run format:check'), true);
    assert.equal(ci.includes('npm test'), true);
  });

  it('ships the editor and ignore files', () => {
    for (const path of [
      '.editorconfig',
      '.gitignore',
      '.prettierrc.json',
      'eslint.config.js',
    ]) {
      assert.equal(read(path).length > 0, true);
    }
    assert.equal(read('.gitignore').includes('node_modules/'), true);
  });

  it('has no comments in javascript files', () => {
    const files = walk(root, []);
    assert.equal(files.length > 0, true);
    for (const file of files) {
      assert.equal(hasComment(readFileSync(file, 'utf8')), false, file);
    }
  });
});
