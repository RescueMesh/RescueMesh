import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const OUTPUT = path.join(ROOT, 'runtime', 'pages');
const ROOT_FILES = ['index.html', 'styles.css', 'app.js', 'brand.png', 'og.png', 'og-en.png'];

async function copyFile(sourceName, destinationName = sourceName) {
  const source = path.join(WEB, sourceName);
  const destination = path.join(OUTPUT, destinationName);
  const sourceInfo = await fs.lstat(source);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error(`Pages source must be a regular file: ${sourceName}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

export async function buildPages() {
  await fs.rm(OUTPUT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT, { recursive: true });
  for (const file of ROOT_FILES) await copyFile(file);
  await copyFile('en.html', path.join('en', 'index.html'));
  await fs.writeFile(path.join(OUTPUT, '.nojekyll'), '', { encoding: 'utf8', flag: 'wx' });
  await fs.writeFile(path.join(OUTPUT, 'robots.txt'), 'User-agent: *\nAllow: /\n', { encoding: 'utf8', flag: 'wx' });
  await fs.writeFile(
    path.join(OUTPUT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://rescuemesh.github.io/RescueMesh/</loc></url>\n  <url><loc>https://rescuemesh.github.io/RescueMesh/en/</loc></url>\n</urlset>\n',
    { encoding: 'utf8', flag: 'wx' },
  );
  return OUTPUT;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await buildPages();
  console.log(`GitHub Pages artifact ready: ${path.relative(ROOT, output)}`);
}
