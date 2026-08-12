import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'runtime']);
const FORBIDDEN_NAMES = [/wallet\.dat$/i, /hs_ed25519_secret_key$/i, /\.rawtx$/i, /\.psbt$/i, /\.pem$/i, /\.key$/i, /\.share$/i];
const CONTENT_RULES = [
  ['private PEM', /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/],
  ['extended private key', /\b[xtyuzv]prv[1-9A-HJ-NP-Za-km-z]{40,}\b/],
  ['WIF private key', /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/],
  ['mnemonic assignment', /\b(?:mnemonic|seed_phrase)\s*[:=]\s*["'][a-z]+(?:\s+[a-z]+){11,23}["']/i],
  ['secret assignment', /\b(?:api[_-]?token|private[_-]?key|password|secret)\s*[:=]\s*["'][A-Za-z0-9_+\/=.-]{24,}["']/i],
  ['large raw hexadecimal blob', /(?:^|[^a-f0-9])[a-f0-9]{1000,}(?:$|[^a-f0-9])/i],
];

async function walk(directory, files = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, files);
    else files.push(target);
  }
  return files;
}

const findings = [];
for (const file of await walk(ROOT)) {
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  if (FORBIDDEN_NAMES.some((rule) => rule.test(relative))) findings.push(`${relative}: forbidden secret-bearing filename`);
  const stat = await fs.stat(file);
  if (stat.size > 2_000_000) findings.push(`${relative}: unexpectedly large repository file (${stat.size} bytes)`);
  if (stat.size > 1_000_000) continue;
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  for (const [label, rule] of CONTENT_RULES) if (rule.test(text)) findings.push(`${relative}: possible ${label}`);
}

if (findings.length) {
  console.error(`Secret scan refused the repository:\n${findings.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Secret scan OK: no publishable secret patterns found');
}
