import { hash256 } from '../lib/crypto.mjs';
import { assertTxid } from '../lib/validation.mjs';

function txidToInternal(txid) {
  return Buffer.from(assertTxid(txid), 'hex').reverse();
}

export function merkleRootFromTxids(txids) {
  if (!Array.isArray(txids) || txids.length === 0) throw new Error('At least one txid is required');
  let level = txids.map(txidToInternal);
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(Buffer.from(level[level.length - 1]));
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      next.push(hash256(Buffer.concat([level[index], level[index + 1]])));
    }
    level = next;
  }
  return Buffer.from(level[0]).reverse().toString('hex');
}

export function merklePathFromTxids(txids, leafIndex) {
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= txids.length) throw new Error('Invalid leaf index');
  let index = leafIndex;
  let level = txids.map(txidToInternal);
  const path = [];
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(Buffer.from(level[level.length - 1]));
    path.push(Buffer.from(level[index ^ 1]).reverse().toString('hex'));
    const next = [];
    for (let cursor = 0; cursor < level.length; cursor += 2) {
      next.push(hash256(Buffer.concat([level[cursor], level[cursor + 1]])));
    }
    index = Math.floor(index / 2);
    level = next;
  }
  return path;
}
