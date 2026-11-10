'use strict';
// Scam Guardian analysis engine.
//
// Every verdict is a sum of named signals with fixed points, and every signal
// is returned with the verdict so the user (and the judges) can see exactly
// WHY. No black box, no model. Thresholds: 0-14 SAFE, 15-39 CAUTION, 40+ SCAM.
//
// Two kinds of input:
//  - a NEAR account id (e.g. "aurora.near") -> live on-chain reputation check
//  - any other text (a message, a post, a link) -> pattern check against
//    data/patterns.json; if the text contains a *.near account, that account
//    is checked live too and its signals are merged in.

const fs = require('fs');
const path = require('path');
const near = require('./near');

const patternsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'patterns.json'), 'utf8'));
const officialsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'officials.json'), 'utf8'));
const OFFICIALS = officialsData.officials;

const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const SCAMMY_NAME_WORDS = ['airdrop', 'claim', 'reward', 'rewards', 'giveaway', 'official', 'support', 'verify', 'bonus', 'promo', 'free'];

function verdictFor(score) {
  if (score >= 40) return 'SCAM';
  if (score >= 15) return 'CAUTION';
  return 'SAFE';
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function findOfficial(accountId) {
  return OFFICIALS.find((o) => o.account === accountId) || null;
}

// A name is a lookalike if it is very close to a known official account but
// is not that account: tiny edit distance, or it contains the official's
// core name with extra words attached ("aurora-rewards.near").
function lookalikeOf(accountId) {
  for (const o of OFFICIALS) {
    if (o.account === accountId) continue;
    if (editDistance(accountId, o.account) <= 2) return o;
    const core = o.account.replace(/\.near$/, '');
    const firstLabel = accountId.split('.')[0];
    if (core.length >= 4 && firstLabel.includes(core) && accountId !== o.account) return o;
  }
  return null;
}

async function checkAccount(accountId, signals, facts) {
  const official = findOfficial(accountId);
  if (official) {
    signals.push({
      id: 'known-official', points: 0,
      label: `Known project account: ${official.project}`,
      detail: `${accountId} is on our hand-checked list of well-known NEAR project accounts (data/officials.json).`,
    });
  }

  let view;
  try {
    view = await near.viewAccount(accountId);
  } catch (e) {
    facts.rpcError = 'The NEAR blockchain could not be reached just now, so the live checks could not run.';
    return;
  }

  if (!view.exists) {
    facts.exists = false;
    signals.push({
      id: 'account-not-found', points: 50,
      label: 'This account does not exist on NEAR',
      detail: 'We asked the NEAR blockchain directly: there is no account with this name. ' +
        'Anyone asking you to send funds here, or claiming this is an official account, is not telling the truth. ' +
        'If a friend gave you this address, it may be mistyped - ask them to check it.',
    });
  } else {
    facts.exists = true;
    facts.balanceNear = view.balanceNear;
    facts.hasContract = view.hasContract;

    if (view.balanceNear < 0.01) {
      signals.push({
        id: 'empty-account', points: 10,
        label: 'Account holds almost no NEAR',
        detail: `The account holds ${view.balanceNear.toFixed(4)} NEAR. Real project accounts that handle prizes or airdrops hold funds; empty accounts claiming to pay out are a warning sign.`,
      });
    }

    const info = await near.indexerInfo(accountId);
    if (info.createdAt) {
      facts.createdAt = info.createdAt.toISOString();
      const ageDays = (Date.now() - info.createdAt.getTime()) / 86400000;
      facts.ageDays = Math.floor(ageDays);
      if (!official && ageDays < 7) {
        signals.push({
          id: 'brand-new-account', points: 30,
          label: `Account is brand new (${Math.max(0, Math.floor(ageDays))} days old)`,
          detail: 'This account was created in the last 7 days. Scam accounts are usually created the same week they are used, then abandoned.',
        });
      } else if (!official && ageDays < 30) {
        signals.push({
          id: 'new-account', points: 15,
          label: `Account is new (${Math.floor(ageDays)} days old)`,
          detail: 'This account was created in the last 30 days. New accounts are not automatically scams, but they have no track record to trust.',
        });
      }
    }
    if (info.recentTxCount !== null) {
      facts.recentTxCount = info.recentTxCount;
      if (!official && info.recentTxCount < 5) {
        signals.push({
          id: 'low-activity', points: 10,
          label: `Almost no activity (fewer than 5 transactions in its recent history)`,
          detail: 'This account has barely been used. An account claiming to run a big airdrop or support desk with almost no history does not add up.',
        });
      }
    }
  }

  const look = lookalikeOf(accountId);
  if (look) {
    signals.push({
      id: 'lookalike-name', points: 45,
      label: `Name imitates ${look.account} (${look.project})`,
      detail: `"${accountId}" looks almost like the real "${look.account}" but it is a different account. Copying a famous name with small changes is one of the oldest scam tricks.`,
    });
  }

  const nameWords = accountId.split(/[.\-_]+/);
  const badWords = nameWords.filter((w) => SCAMMY_NAME_WORDS.includes(w));
  if (!official && badWords.length > 0) {
    signals.push({
      id: 'scammy-name-words', points: 20,
      label: `Name contains bait words: ${badWords.join(', ')}`,
      detail: 'The account name itself advertises airdrops, rewards, claims or support. Real projects rarely put bait words like these in their account name.',
    });
  }

  return official;
}

function extractDomains(text) {
  const domains = new Set();
  const urlRe = /(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    domains.add(m[0].replace(/^https?:\/\//i, '').split('/')[0].toLowerCase());
  }
  // Tokens ending in .near are account ids, not websites - skip those.
  return [...domains].filter((d) => !d.endsWith('.near') && d !== 'near');
}

function checkText(text, signals) {
  const lower = text.toLowerCase();
  for (const p of patternsData.patterns) {
    if (p.type === 'lookalike-domain') {
      const bad = extractDomains(text).filter((d) =>
        p.brandWords.some((b) => d.includes(b)) &&
        !p.trustedDomains.some((t) => d === t || d.endsWith('.' + t)));
      if (bad.length > 0) {
        signals.push({
          id: p.id, points: p.points, label: p.label,
          detail: `${p.why} Found: ${bad.join(', ')}.`,
        });
      }
      continue;
    }
    const matched = [];
    for (const kw of p.keywords || []) if (lower.includes(kw)) matched.push(`"${kw}"`);
    for (const rx of p.regex || []) if (new RegExp(rx, 'i').test(text)) matched.push('a matching phrase');
    if (matched.length > 0) {
      signals.push({
        id: p.id, points: p.points, label: p.label,
        detail: `${p.why} Matched: ${matched.slice(0, 3).join(', ')}.`,
      });
    }
  }
}

async function analyze(rawInput) {
  const input = String(rawInput || '').trim();
  const signals = [];
  const facts = {};
  if (!input) return { input, type: 'empty', verdict: 'CAUTION', score: 0, signals, facts };

  const isSingleAccount = !/\s/.test(input) && ACCOUNT_RE.test(input.toLowerCase()) &&
    (input.toLowerCase().endsWith('.near') || input.toLowerCase() === 'near' || /^[0-9a-f]{64}$/.test(input));

  if (isSingleAccount) {
    const accountId = input.toLowerCase();
    facts.account = accountId;
    const official = await checkAccount(accountId, signals, facts);
    const score = signals.reduce((s, x) => s + x.points, 0);
    const verdict = official ? 'SAFE' : verdictFor(score);
    return { input, type: 'account', verdict, score: official ? 0 : score, signals, facts };
  }

  // Message / link path: pattern checks, plus a live check of the first
  // *.near account mentioned in the text, if any - but only when it is not
  // just part of a URL or domain (docs.near.org is a website, not a wallet).
  checkText(input, signals);
  const withoutUrls = input.replace(/(https?:\/\/\S+)|(\b[\w-]+(\.[\w-]+)*\.(com|org|net|io|xyz|app|dev|co|me|info|site|online|fun|club|live)\b\S*)/gi, ' ');
  const mentioned = withoutUrls.toLowerCase().match(/([a-z0-9\-_]+\.)+near\b/);
  if (mentioned) {
    facts.accountMentioned = mentioned[0];
    const before = signals.length;
    await checkAccount(mentioned[0], signals, facts);
    for (let i = before; i < signals.length; i++) {
      signals[i].label += ' (account named in the message)';
    }
  }
  const score = signals.reduce((s, x) => s + x.points, 0);
  return { input, type: 'message', verdict: verdictFor(score), score, signals, facts };
}

module.exports = { analyze, verdictFor };
