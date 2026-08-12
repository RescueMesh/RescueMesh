import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPages } from '../scripts/build-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function listFiles(directory, root = directory, files = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await listFiles(target, root, files);
    else files.push(path.relative(root, target).replaceAll('\\', '/'));
  }
  return files.sort();
}

test('Pages build publishes only the strict static allowlist', async () => {
  const output = await buildPages();
  const files = await listFiles(output);
  assert.deepEqual(files, [
    '.nojekyll',
    'app.js',
    'brand.png',
    'en/index.html',
    'index.html',
    'og-en.png',
    'og.png',
    'robots.txt',
    'sitemap.xml',
    'styles.css',
  ]);
  assert.equal(files.some((file) => /config|runtime|secret|transaction/i.test(file)), false);
  assert.match(await fs.readFile(path.join(output, 'en/index.html'), 'utf8'), /lang="en"/);
  assert.match(await fs.readFile(path.join(output, 'index.html'), 'utf8'), /lang="es"/);
});

test('Pages workflow uploads the generated public directory only', async () => {
  const workflow = await fs.readFile(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /path: runtime\/pages/);
  assert.doesNotMatch(workflow, /path:\s*[.'"]+\s*$/m);
  assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d/m);
});
