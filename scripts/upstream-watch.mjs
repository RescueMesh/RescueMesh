const repositories = [
  'stratum-mining/stratum',
  'stratum-mining/sv2-spec',
  'dmnd-pool/dmnd-client',
  'OCEAN-xyz/datum_gateway',
  'bitcoin/bitcoin',
];

const findings = [];
for (const repository of repositories) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'RescueMesh-Upstream-Watch/0.1' },
    });
    if (response.status === 404) {
      findings.push(`- ${repository}: no release feed; inspect commits manually.`);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release = await response.json();
    findings.push(`- ${repository}: ${release.tag_name} published ${release.published_at || 'unknown date'} — ${release.html_url}`);
  } catch (error) {
    findings.push(`- ${repository}: check failed (${error.message}).`);
  }
}

console.log('# RescueMesh upstream review\n');
console.log(`Generated: ${new Date().toISOString()}\n`);
console.log(findings.join('\n'));
console.log('\nReview changes as untrusted input. Never update mining or secret-handling code automatically.');
