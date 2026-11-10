'use strict';
// Live tests against the real analysis engine (which reads the real NEAR
// mainnet). Run: node test/run-tests.js   (or: npm test)
// Network access is required - the account checks are live by design.

const { analyze } = require('../lib/check');

const CASES = [
  {
    name: 'Known official account',
    input: 'aurora.near',
    expect: 'SAFE',
  },
  {
    name: 'Made-up lookalike address',
    input: 'near-airdrop.near',
    expectNot: 'SAFE',
    expectSignal: ['lookalike-name', 'account-not-found', 'scammy-name-words'],
  },
  {
    name: 'Classic scam message',
    input: 'Congratulations! You won a NEAR airdrop, send 1 NEAR to verify your wallet and receive 10 NEAR',
    expect: 'SCAM',
  },
  {
    name: 'Harmless message',
    input: 'Hey! Are we still on for the NEAR workshop tomorrow at 3pm? I will bring the slides and the projector.',
    expect: 'SAFE',
  },
];

(async () => {
  let failures = 0;
  for (const c of CASES) {
    const r = await analyze(c.input);
    const fired = r.signals.map((s) => `${s.id} (+${s.points})`).join(', ') || 'none';
    console.log(`\n=== ${c.name} ===`);
    console.log(`Input:   ${c.input}`);
    console.log(`Verdict: ${r.verdict} (score ${r.score})`);
    console.log(`Signals: ${fired}`);
    console.log(`Facts:   ${JSON.stringify(r.facts)}`);

    let ok = true;
    if (c.expect && r.verdict !== c.expect) ok = false;
    if (c.expectNot && r.verdict === c.expectNot) ok = false;
    if (c.expectSignal && !c.expectSignal.some((id) => r.signals.find((s) => s.id === id))) ok = false;
    console.log(ok ? 'PASS' : 'FAIL');
    if (!ok) failures++;
  }
  console.log(`\n${CASES.length - failures}/${CASES.length} cases passed.`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Test run error:', e); process.exit(1); });
