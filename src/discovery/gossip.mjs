import { rejectSensitiveKeys } from '../lib/validation.mjs';

function normalizeSeed(seed) {
  const url = new URL(seed);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Gossip seeds require HTTPS; onion transport needs a local Tor proxy adapter');
  }
  return url.toString().replace(/\/$/, '');
}

export async function gossipOnce({ registry, seeds, ownAnnouncement, timeoutMs = 5000, fetchImpl = fetch }) {
  const results = [];
  for (const seed of seeds.map(normalizeSeed)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (ownAnnouncement) {
        rejectSensitiveKeys(ownAnnouncement);
        const response = await fetchImpl(`${seed}/v1/announcements`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(ownAnnouncement),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`push failed with HTTP ${response.status}`);
      }
      const response = await fetchImpl(`${seed}/v1/announcements`, { signal: controller.signal });
      if (!response.ok) throw new Error(`pull failed with HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.announcements)) throw new Error('invalid gossip response');
      let accepted = 0;
      for (const announcement of payload.announcements) {
        try { registry.accept(announcement); accepted += 1; } catch { /* Ignore invalid or stale peers. */ }
      }
      results.push({ seed, ok: true, accepted });
    } catch (error) {
      results.push({ seed, ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}

export function startGossipLoop({ registry, seeds, createAnnouncement, intervalMs = 300_000, onResult = () => {} }) {
  if (typeof createAnnouncement !== 'function') throw new Error('Gossip announcement factory is required');
  if (!Number.isInteger(intervalMs) || intervalMs < 30_000) throw new Error('Gossip interval must be at least 30 seconds');
  let stopped = false;
  let running = false;
  let timer;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const announcement = await createAnnouncement();
      try { registry.accept(announcement); } catch (error) {
        if (!/not newer/.test(error.message)) throw error;
      }
      const results = await gossipOnce({ registry, seeds, ownAnnouncement: announcement });
      onResult({ ok: true, peers: results });
    } catch (error) {
      onResult({ ok: false, error: error.message });
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };
  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
