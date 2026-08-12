import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'runtime']);

async function walk(directory, files = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, files);
    else files.push(target);
  }
  return files;
}

const files = await walk(ROOT);
const problems = [];
for (const file of files) {
  const extension = path.extname(file);
  if (['.mjs', '.js'].includes(extension)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) problems.push(`${path.relative(ROOT, file)}: ${result.stderr.trim()}`);
  }
  if (extension === '.json') {
    try { JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { problems.push(`${path.relative(ROOT, file)}: invalid JSON (${error.message})`); }
  }
  if (['.mjs', '.js', '.json', '.md', '.css', '.html'].includes(extension)) {
    const text = await fs.readFile(file, 'utf8');
    if (/\r(?!\n)/.test(text)) problems.push(`${path.relative(ROOT, file)}: stray carriage return`);
    if (/[ \t]+$/m.test(text)) problems.push(`${path.relative(ROOT, file)}: trailing whitespace`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Lint OK: ${files.length} repository files checked`);
}
