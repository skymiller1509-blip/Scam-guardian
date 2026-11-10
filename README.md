# Scam Guardian

**Track:** AI Security & Defense (`security`) - NEAR HACKATHON
**One-line summary:** Paste a NEAR address, a message or a link. Get one clear verdict - SAFE, CAUTION or SCAM - with the reasons, backed by live NEAR blockchain data.

## The problem

People lose NEAR every day to the same few tricks: a fake "official" account whose name is one letter away from a real project, a message saying they won an airdrop if they send a small "verification" payment first, a link that looks like near.org but is not. The victim usually has ten seconds to decide and no easy way to check. Scam Guardian is that check.

## What it does

A user pastes one of three things:

- **a NEAR account id** - Guardian asks the NEAR blockchain itself, live: does this account exist? How old is it? How much does it hold? Has it ever really been used? Does its name imitate a known project (for example `aurora.near` vs a lookalike)?
- **a message or post** - Guardian checks it against an open list of scam patterns: seed-phrase requests, send-first-to-receive, guaranteed returns, fake airdrop wins, fake support accounts, urgency pressure, hidden short links, lookalike domains. Every pattern that fires is named, with a plain-language explanation.
- **a message that names an account** - both checks run, and the account's live on-chain signals are merged into the same verdict.

The verdict is a simple score. Every signal has fixed points, listed in the open. 0-14 = SAFE, 15-39 = CAUTION, 40+ = SCAM. There is no machine-learning black box: anyone can open `data/patterns.json` and `lib/check.js` and see exactly why a verdict came out the way it did.

## How NEAR fits in (concretely)

The account check is not a static list. For every address it makes **live read-only calls to NEAR mainnet** through public RPC endpoints (`view_account`: existence, balance, whether a contract is deployed) and reads account creation time and recent activity from the public NearBlocks indexer. No wallet connection, no API keys, no signing - reads only. A name that imitates a known project account is scored against a small hand-checked list of real project accounts (`data/officials.json`), using edit distance and name-shape rules.

This is the "reputation and scam detection" half of the AI Security & Defense track: a counterparty check that a person - or an agent about to pay an address - can ask before money moves.

## Try it (do X - see Y)

You need Node.js 18 or newer. There are **no dependencies to install**.

1. Run `node server.js` in this folder. Open http://localhost:3000.
2. Paste `aurora.near` and press **Check it** - see **SAFE**, with live facts: the account exists, was created on 2020-09-16, holds a balance, has a contract deployed.
3. Paste `near-airdrop.near` and press **Check it** - see **SCAM**, with the reasons: the name imitates the `near` account, contains the bait word "airdrop", holds almost no NEAR, and has almost no activity.
4. Paste the message `Congratulations! You won a NEAR airdrop, send 1 NEAR to verify your wallet and receive 10 NEAR` - see **SCAM**, with the two patterns that fired named and explained.
5. Or run the same checks from the terminal: `npm test` (live tests against real mainnet data; needs internet).

## Run it

```
node server.js          # http://localhost:3000
PORT=8080 node server.js # custom port
npm test                # live test suite (4 cases)
```

## Files

| File | What it is |
| --- | --- |
| `server.js` | Tiny web server (Node.js built-ins only) + `POST /api/check` |
| `lib/check.js` | The scoring engine: every signal, its points, its plain-language reason |
| `lib/near.js` | Live NEAR access: public RPC endpoints with fallback + NearBlocks indexer |
| `data/patterns.json` | The scam-pattern dataset. Readable, editable, every rule in plain words |
| `data/officials.json` | Hand-checked list of well-known project accounts used for lookalike detection |
| `public/` | The single-page web UI (no build step) |
| `test/run-tests.js` | Live tests: official account, lookalike address, scam message, harmless message |

## Honest limits

- The officials list is small on purpose (7 accounts) so every entry can be verified by hand. Not being listed does **not** make an account a scam; the engine never scores absence from the list.
- A brand-new legitimate account will score some caution points. That is deliberate: new + empty + bait-name is exactly the shape of a scam account, and the reasons are always shown so a human can judge.
- If the public RPCs or the indexer are unreachable, Guardian says so in the result instead of guessing.

## Demo

`demo.mp4` in this repository shows the whole moment in under a minute:

1. Paste `near-airdrop.near` - 🛑 **SCAM**, with the live facts and the reasons.
2. Paste the "You won a NEAR airdrop, send 1 NEAR to verify..." message - 🛑 **SCAM**, different reasons.
3. Paste `aurora.near` - ✅ **SAFE**, with its real age and balance, proving the checks are live blockchain reads.

The public demo post on X uses the text drafted in `X_POST.md` in this repository, with this video attached.

## Two projects, disclosed (per hackathon rules Q-015)

This is one of two independent projects by the same solo builder in this hackathon. The other is **Time-Locked Gifts** (NFTs That Do Something track) - a gift NFT that holds NEAR in a contract-locked pot until a chosen date - in its own separate repository. Each project's README names the other, as Q-015 requires.

## Baseline disclosure (per hackathon rules Q-001 / Q-005)

The *idea* of a "Scam Guardian" was sketched before this hackathon as a one-paragraph grant concept. **No code existed before this repository.** All code, data files and text in this repository were written during the NEAR HACKATHON window, starting 2026-11-10. No pre-existing libraries of ours are used; the app runs on Node.js built-ins only. AI coding assistance was used (allowed under Q-005).

## Possible next steps (not in this submission)

- A tiny NEAR **testnet** contract that logs verdicts on-chain, so agents can read a shared, auditable check history before paying an address. This was considered for this submission and deliberately left out: the live mainnet read is already the NEAR integration, and a second moving part would have weakened the zero-install reproducibility the screeners check. It stays a good next step after the hackathon.
- A community blocklist: anyone can report an account with evidence attached; reports are public and scored for reporter reputation.
- A browser extension that checks addresses and links on the page you are already looking at.

## License

MIT - see `LICENSE`.
