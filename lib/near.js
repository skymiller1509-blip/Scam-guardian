'use strict';
// Read-only NEAR access. Public RPC endpoints only - no API keys, no wallet.
// Multiple endpoints are tried in order because public RPCs rate-limit and
// time out; the first one that answers wins.

const RPC_ENDPOINTS = [
  'https://near.drpc.org',
  'https://rpc.mainnet.near.org',
  'https://rpc.fastnear.com',
  'https://near.lava.build',
];

const INDEXER_BASE = 'https://api.nearblocks.io/v1'; // keyless public indexer
const TIMEOUT_MS = 8000;
const NO_CODE_HASH = '11111111111111111111111111111111'; // NEAR's "no contract deployed" code hash

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function rpcQuery(params) {
  let lastError;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const body = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'scam-guardian', method: 'query', params }),
      });
      if (body.error) {
        const err = new Error(body.error.cause?.name || body.error.message || 'RPC error');
        err.rpcError = body.error;
        throw err;
      }
      return body.result;
    } catch (e) {
      lastError = e;
      // A definitive "account does not exist" answer is a real answer, not a failure.
      const cause = e.rpcError?.cause?.name || '';
      if (cause === 'UNKNOWN_ACCOUNT' || /doesn'?t exist/i.test(e.message)) {
        return { __notFound: true };
      }
    }
  }
  throw lastError || new Error('All NEAR RPC endpoints failed');
}

// Returns { exists, balanceNear, hasContract } for a mainnet account id.
async function viewAccount(accountId) {
  const result = await rpcQuery({
    request_type: 'view_account',
    finality: 'final',
    account_id: accountId,
  });
  if (result.__notFound) return { exists: false };
  const yocto = BigInt(result.amount);
  return {
    exists: true,
    balanceNear: Number(yocto) / 1e24,
    hasContract: result.code_hash !== NO_CODE_HASH,
  };
}

// Account age and activity from the keyless NearBlocks indexer.
// Returns null fields (not errors) when the indexer is unreachable, so the
// caller can say "unknown" instead of guessing.
async function indexerInfo(accountId) {
  const info = { createdAt: null, recentTxCount: null };
  try {
    const body = await fetchJson(`${INDEXER_BASE}/account/${encodeURIComponent(accountId)}`);
    const acct = body.account?.[0];
    const tsNs = acct?.created?.block_timestamp;
    if (tsNs) info.createdAt = new Date(Number(BigInt(tsNs) / 1000000n));
  } catch { /* indexer down: leave null */ }
  try {
    // No count endpoint exists on the keyless API; fetch the newest page of
    // transactions instead. A short page = a barely-used account; a full
    // page proves at least that much real history.
    const body = await fetchJson(`${INDEXER_BASE}/account/${encodeURIComponent(accountId)}/txns?per_page=25`);
    if (Array.isArray(body.txns)) info.recentTxCount = body.txns.length;
  } catch { /* indexer down: leave null */ }
  return info;
}

module.exports = { viewAccount, indexerInfo, RPC_ENDPOINTS };
