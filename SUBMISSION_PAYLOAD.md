# Submission payload - Scam Guardian (DRAFT - do not send yet)

This is the exact JSON that will be sent to `POST https://nearhackathon.com/api/applications`,
**only after Eddie has read it back and confirmed it**, and only after the repo is public and the
X demo post is live. One submission per project: there is no second attempt (a repeat is rejected
with 409; mistakes are fixed via https://nearhackathon.com/request-changes).

Rules for this payload:
- Send exactly these fields. **Never add a `website` field** - it is a spam trap and any non-empty
  value rejects the submission automatically.
- Keep the `requestId` below. If sending fails with a network error or a 503, retry with the
  SAME `requestId` - the server treats it as the same submission.
- Values in `<ANGLE BRACKETS>` are Eddie's own details. They must come from Eddie, never guessed.

```json
{
  "requestId": "d7b5e9e4-bb7e-4ce9-8e0a-10359193c4e5",
  "projectName": "Scam Guardian",
  "leadName": "<EDDIE'S FULL NAME>",
  "email": "<EDDIE'S EMAIL>",
  "size": "1",
  "tracks": ["security"],
  "nearAddress": "<EDDIE'S MAINNET NEAR ACCOUNT, e.g. hisname.near>",
  "projectUrl": "<PUBLIC REPO URL, after Eddie publishes this repo>",
  "demoUrl": "<URL OF EDDIE'S X DEMO POST>",
  "idea": "People lose NEAR to fake 'official' accounts, fake airdrop messages and lookalike links, and they usually have seconds to decide. Scam Guardian is the check you run before you send: paste a NEAR address, a message or a link and get one clear verdict - SAFE, CAUTION or SCAM - with every reason named in plain words. For an address it reads the NEAR blockchain live through public RPC (does it exist, its balance, whether a contract is deployed) plus account age and recent activity from a public indexer, and it scores names that imitate known project accounts. Message checks run on an open, readable pattern list (data/patterns.json) - no black box. No wallet connection, nothing stored, and it runs with plain Node.js and zero dependencies.",
  "consent": true
}
```

Before sending, Eddie must:
1. Fill in the five `<...>` values above from his own details.
2. Read this consent sentence and agree to it (that is what `"consent": true` means):
   "I agree that the organizers may use these details to review our submission and contact us about this hackathon."
3. Read the whole payload once more and say yes. Only then is it sent.
