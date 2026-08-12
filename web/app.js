const byId = (id) => document.getElementById(id);

async function refreshHealth() {
  const pill = byId('health-pill');
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const health = await response.json();
    pill.textContent = 'Servicio local activo';
    pill.className = 'pill ok';
    byId('network').textContent = health.network;
    byId('mainnet').textContent = health.mainnetLocked ? 'Bloqueada' : 'Revisar';
    byId('nodes').textContent = String(health.announcements);
    byId('jobs').textContent = String(health.publicJobs);
  } catch {
    pill.textContent = 'Servicio no disponible';
    pill.className = 'pill error';
  }
}

byId('simulator').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const body = {
    rescueVsize: Number(data.get('rescueVsize')),
    rescueFeeSats: Number(data.get('rescueFeeSats')),
    freeSpaceVbytes: Number(data.get('freeSpaceVbytes')),
    marginalRateMilliSatsPerVbyte: Math.round(Number(data.get('marginalRate')) * 1000),
    auxiliaryRevenueSats: Number(data.get('auxiliaryRevenueSats')),
    infrastructureSavingsSats: Number(data.get('infrastructureSavingsSats')),
    minimumNetGainSats: 0,
  };
  const result = byId('result');
  try {
    const response = await fetch('/v1/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'No se pudo evaluar');
    const value = payload.evaluation;
    result.className = `result ${value.accepted ? 'good' : 'bad'}`;
    const heading = document.createElement('strong');
    heading.textContent = value.accepted ? 'Plantilla económicamente aceptable' : 'Plantilla rechazada';
    const details = document.createTextNode(` Ganancia neta estimada: ${value.netGainSats.toLocaleString('es-ES')} sats · `
      + `coste de oportunidad: ${value.opportunityCostSats.toLocaleString('es-ES')} sats · `
      + `cargo adicional al propietario: ${value.userAdditionalChargeSats} sats.`);
    result.replaceChildren(heading, document.createElement('br'), details);
  } catch (error) {
    result.className = 'result bad';
    result.textContent = error.message;
  }
});

refreshHealth();
setInterval(refreshHealth, 10_000);
