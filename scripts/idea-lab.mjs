import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await fs.readFile(path.join(ROOT, 'research/building-blocks.json'), 'utf8'));

function combinations(values, count, start = 0, prefix = [], result = []) {
  if (prefix.length === count) { result.push(prefix); return result; }
  for (let index = start; index < values.length; index += 1) combinations(values, count, index + 1, [...prefix, values[index]], result);
  return result;
}

function score(combination) {
  const benefits = new Set(combination.flatMap((item) => item.benefits));
  const resolved = new Set(combination.flatMap((item) => item.resolves || []));
  const risks = new Set(combination.flatMap((item) => item.risks).filter((risk) => !resolved.has(risk)));
  let value = [...benefits].reduce((sum, criterion) => sum + (model.criteria[criterion] || 0), 0);
  value += combination.length;
  value += risks.size * model.criteria.securityRisk;
  if (benefits.has('ownerProtection') && benefits.has('minerValue')) value += 5;
  if (benefits.has('decentralization') && combination.some((item) => item.id === 'direct-coinbase-payouts')) value += 3;
  return { value, benefits: [...benefits].sort(), risks: [...risks].sort() };
}

const proposals = [2, 3]
  .flatMap((count) => combinations(model.blocks, count))
  .map((items) => ({ items, ...score(items) }))
  .sort((left, right) => right.value - left.value || left.items.map((item) => item.id).join().localeCompare(right.items.map((item) => item.id).join()))
  .slice(0, 8);

console.log('# RescueMesh Idea Lab — untrusted proposals\n');
console.log('Generated deterministically from public design primitives. Every proposal requires an RFC, threat analysis and tests.\n');
for (const [index, proposal] of proposals.entries()) {
  console.log(`## ${index + 1}. ${proposal.items.map((item) => item.name).join(' + ')}`);
  console.log(`\n- Score: ${proposal.value}`);
  console.log(`- Benefits: ${proposal.benefits.join(', ') || 'none'}`);
  console.log(`- Unresolved risks: ${proposal.risks.join(', ') || 'none identified by this simple model'}\n`);
}
