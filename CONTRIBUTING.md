# Contributing

Thanks for helping. Knock is small on purpose: one household, one door.

## Run it locally
```bash
npm install
npm run dev:mock   # embedded database and a mock phone line (no Telnyx needed)
npm test           # routing, claim-once, auto-open, webhook signatures, push
```

## Before you open a pull request
- Keep it small and focused; say what problem it solves.
- Add or update a test when you change routing, calls, or security checks.
- `npm test` and `npx tsc --noEmit` pass.
- Never commit real phone numbers, API keys or `.env` files. Use the fictional +1 415 555 0123 in examples.

## Design
The look is iOS-style Liquid Glass over a warm gradient. Tokens live in `app/globals.css`; reuse them instead of adding colours.
