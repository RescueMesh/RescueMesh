import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
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
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);

async function walk(directory, files = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, files);
    else files.push(target);
  }
  return files;
}

export async function scanFile(file, relative, { openFile = fs.open } = {}) {
  const findings = [];
  if (FORBIDDEN_NAMES.some((rule) => rule.test(relative))) {
    findings.push(relative + ': forbidden secret-bearing filename');
  }

  let handle;
  try {
    // Keep one descriptor from inspection through reading. This prevents the
    // path from being swapped between a size check and the content scan.
    handle = await openFile(file, READ_FLAGS);
    const stat = await handle.stat();
    if (!stat.isFile()) {
      findings.push(relative + ': repository entry is not a regular file');
      return findings;
    }
    if (stat.size > 2_000_000) {
      findings.push(relative + ': unexpectedly large repository file (' + stat.size + ' bytes)');
    }
    if (stat.size > 1_000_000) return findings;

    const text = await handle.readFile({ encoding: 'utf8' });
    for (const [label, rule] of CONTENT_RULES) {
      if (rule.test(text)) findings.push(relative + ': possible ' + label);
    }
  } catch (error) {
    findings.push(relative + ': could not be scanned (' + (error.code || 'read failure') + ')');
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        findings.push(relative + ': scanner could not close the file descriptor');
      }
    }
  }
  return findings;
}

export async function scanRepository(root = ROOT, options = {}) {
  const findings = [];
  for (const file of await walk(root)) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    findings.push(...await scanFile(file, relative, options));
  }
  return findings;
}

async function main() {
  const findings = await scanRepository();
  if (findings.length) {
    console.error('Secret scan refused the repository:\n' + findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Secret scan OK: no publishable secret patterns found');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  main().catch((error) => {
    console.error('Secret scan failed closed: ' + (error.code || error.message));
    process.exitCode = 1;
  });
}
