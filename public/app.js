'use strict';

const $ = (id) => document.getElementById(id);

async function runCheck() {
  const input = $('input').value.trim();
  const resultBox = $('result');
  const errorBox = $('error');
  errorBox.hidden = true;
  if (!input) { errorBox.textContent = 'Paste something first.'; errorBox.hidden = false; return; }

  $('check').disabled = true;
  $('check').textContent = 'Checking...';
  resultBox.hidden = true;
  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showResult(data);
  } catch (e) {
    errorBox.textContent = 'The check could not run. Please try again in a moment.';
    errorBox.hidden = false;
  } finally {
    $('check').disabled = false;
    $('check').textContent = 'Check it';
  }
}

function showResult(data) {
  const verdictEl = $('verdict');
  verdictEl.textContent = data.verdict === 'SAFE' ? '✅ SAFE' : data.verdict === 'CAUTION' ? '⚠️ CAUTION' : '🛑 SCAM';
  verdictEl.className = 'verdict-' + data.verdict.toLowerCase();

  const f = data.facts || {};
  const lines = [];
  if (f.account || f.accountMentioned) {
    lines.push('✔ This account was checked live on the NEAR blockchain just now - not from a saved list.');
    const acct = f.account || f.accountMentioned;
    if (f.exists === false) lines.push(`Account ${acct}: does not exist on NEAR (checked live just now).`);
    if (f.exists === true) {
      lines.push(`Account ${acct}: exists on NEAR.`);
      if (typeof f.balanceNear === 'number') lines.push(`Balance: ${f.balanceNear.toFixed(4)} NEAR.`);
      if (f.ageDays !== undefined && f.ageDays !== null) lines.push(`Account age: about ${f.ageDays} days.`);
      if (f.recentTxCount !== undefined && f.recentTxCount !== null) lines.push(`Recent transactions found: ${f.recentTxCount}${f.recentTxCount >= 25 ? '+' : ''}.`);
      if (f.hasContract) lines.push('A smart contract is deployed on this account (normal for projects).');
    }
  }
  if (f.rpcError) lines.push(f.rpcError);
  $('facts').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');

  const reasons = $('reasons');
  reasons.innerHTML = '';
  for (const s of data.signals) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${s.label}</strong> (+${s.points})<br>${s.detail}`;
    reasons.appendChild(li);
  }
  $('why-title').hidden = data.signals.length === 0;
  $('clean').hidden = data.signals.length !== 0;
  $('result').hidden = false;
}

$('check').addEventListener('click', runCheck);
document.querySelectorAll('.ex').forEach((b) => b.addEventListener('click', () => {
  $('input').value = b.dataset.v;
  runCheck();
}));
