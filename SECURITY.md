# Security

Knock opens a real door, so security reports are welcome and taken seriously.

**Please don't open a public issue for a vulnerability.** Use GitHub's private reporting instead:
**Security tab, then "Report a vulnerability"** on this repository.

Include what you found, how to reproduce it, and which version or commit you tested. You'll get a reply within a few days.

## What is in scope
- Opening the door without being a household member (auth, invites, sessions).
- Forging or replaying Telnyx webhooks.
- Leaking API keys, VAPID keys, phone numbers or call history.
- Bypassing rate limits on sign-in or invites.

## What Knock already does
- Telnyx webhooks are verified with ed25519 signatures and a 5-minute window.
- A call can be opened once: the claim is a single atomic database update.
- Secrets live only in your own Vercel environment and database.
