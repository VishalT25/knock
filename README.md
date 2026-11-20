# Knock

Open your building's door from your phone. A self-hosted, open-source (MIT) PWA door buzzer for one household.

When a visitor enters your unit code, the building intercom dials your Telnyx number. Knock answers, says "One moment please", holds the line, and notifies everyone in the household. The first person to tap **OPEN DOOR** wins: Knock sends the unlock tone (default `9`) and hangs up. Everyone else sees "Opened by Maya".

> ## ⚠️ This app can unlock a building entrance
>
> - Anyone with a signed-in phone, or access to your deployment's secrets, can open a door that protects other people's homes. Treat it like a physical key.
> - **Keep `SETUP_TOKEN`, invite codes, your Telnyx keys and your Vercel account private.** Revoke lost phones in Settings immediately.
> - **Auto-open is dangerous by design.** While the window is on, *anyone* who enters your unit code is let in with no human check, including a stranger, a tailgater or someone who guesses a code. Keep windows short (max 60 minutes), use them only when you are home and expecting someone, and cancel them as soon as the visitor arrives. Knock tells every household member when it is switched on and every time it fires, and logs each one.
> - Check your lease and building rules. Some buildings forbid remote door release.
> - Provided as-is under the MIT license, with no warranty. You are responsible for how you use it.

## Does my intercom work with this?

Knock only works if both are true. Check **before** you set anything up:

1. **Does the intercom dial an outside phone number?** Look for a "call a phone" / "resident forwards to mobile" feature. The number it dials must be one you can point at your Telnyx number (ask the building manager or intercom company to put your Telnyx number on file, or set your number to forward to it).
2. **Does it accept the unlock tone from a held call?** The intercom opens the door when it hears a touch-tone (usually `9`, sometimes `#`, `*` or another digit) from the answered call. Knock sends that tone, so the intercom has to listen for it while Knock holds the line. Test this: call-forward your current phone, answer, press the digit, and see if the door unlocks. If it only works from certain numbers or with a different digit, set **Unlock digit** in Settings.

Also useful: how long the intercom rings before giving up (Knock answers instantly), and whether it plays its own prompt before connecting (that is fine). The setup wizard's **test call** proves Knock can answer, hold and send a tone to *your* phone; only a real visitor call proves your intercom accepts it.

## Quick start (local, no Telnyx account needed)

```bash
npm install
npm run dev:mock          # app on http://localhost:3000, embedded Postgres, Telnyx mocked
# open http://localhost:3000 -> setup wizard, make an invite, join from a second browser profile
npm run dev:call          # simulates the intercom ringing (signed webhook, mocked Telnyx)
npm run dev:call -- --hangup-after 12   # visitor gives up after 12 s
npm run dev:call -- --url http://localhost:3000 --id my-call
npm test                  # routing, claim-once, auto-open, fallback, signature tests
```

`dev:mock` sets `TELNYX_MOCK=1`: Telnyx is never contacted, actions are printed (`[telnyx:mock] send_dtmf ...`), and webhooks signed with a built-in **dev-only** key are accepted. Both are ignored when `NODE_ENV=production`. Without `DATABASE_URL`, Knock uses an embedded Postgres (PGlite) in `~/.knock/dev-db` (outside the project so file writes don't trigger reloads).

Web push needs HTTPS (or `localhost`) and VAPID keys: `npx web-push generate-vapid-keys`.

## Deploy to Vercel

1. Push this repo to GitHub, then **Add New → Project** in Vercel and import it (free Hobby tier works).
2. Add a database: **Storage → Create → Neon (Postgres)**, connect it to the project. This sets `DATABASE_URL`. Tables are created automatically on first request.
3. Add the environment variables below (**Settings → Environment Variables**), deploy, and note the production URL, e.g. `https://knock-yourname.vercel.app`.
4. Set `APP_URL` to that URL and redeploy once.
5. Do the Telnyx steps below, using `https://<your-app>/api/telnyx` as the webhook URL.
6. Open the app URL on your phone → the setup wizard. Add it to your Home Screen (iPhone: Share → Add to Home Screen; Android: install prompt / menu → Install app), open it from there, and enable notifications.

The call lifecycle (escalation, backup call) runs in the webhook function after it responds, using `maxDuration = 120`. The Open screen also nudges it forward whenever a phone is watching, so a slow function can't stall an escalation.

## Telnyx setup

1. **Create an account** at telnyx.com and complete verification. Add a small balance (a number costs about a dollar a month plus per-minute usage).
2. **Buy a number**: *Numbers → Buy Numbers*, pick a local number with **Voice** enabled, and buy it.
3. **Create a Call Control application**: *Voice → Programmable Voice → Applications → Add new app* → type **Call Control**. Set:
   - **Webhook URL**: `https://<your-app>/api/telnyx`
   - Webhook API version **API V2**
   - Leave "Send DTMF with SIP INFO" off. Save, and copy the app's **ID** → `TELNYX_CONNECTION_ID`.
4. **Assign the number** to that application (*Numbers → My Numbers → Voice → Connection or App*).
5. **API key**: *Account → Keys & Credentials → API Keys* → create → `TELNYX_API_KEY`.
6. **Public key**: same page, **Public Key** (base64) → `TELNYX_PUBLIC_KEY`. Knock rejects every webhook that is not signed with it.
7. Put this number on file with your building/intercom as the number to call. Set `TELNYX_NUMBER` to it in E.164 form (`+14155550123`).
8. If you want the fallback (a person who presses the digit by hand), set `FALLBACK_NUMBER` and make sure your Telnyx outbound voice profile allows calling it.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | embedded dev DB | Neon/Vercel Postgres URL |
| `APP_URL` | recommended | request origin | Public URL, used by the wizard's webhook check |
| `SETUP_TOKEN` | **yes in production** | none | Secret that first-run setup requires, so strangers can't claim your deployment |
| `TELNYX_API_KEY` | yes | | Server-side only, never sent to the browser |
| `TELNYX_PUBLIC_KEY` | yes | | Webhook ed25519 signature verification |
| `TELNYX_CONNECTION_ID` | for test/fallback calls | | Call Control application ID |
| `TELNYX_NUMBER` | for test/fallback calls | | Your Telnyx number, E.164 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | yes | | Web push (`npx web-push generate-vapid-keys`) |
| `UNLOCK_DIGIT` | no | `9` | Tone sent to open the door |
| `ESCALATE_AFTER` | no | `8` | Seconds before everyone is notified loudly |
| `BACKUP_TIMEOUT` | no | `20` | Seconds before the fallback number is dialled |
| `FALLBACK_NUMBER` | no | none | Rings if nobody opens; bridged to the held call |
| `AUTO_OPEN_MAX_MINUTES` | no | `60` | Longest auto-open window (hard cap 60) |
| `GREETING` | no | off | `1` makes Knock say "One moment please" to the visitor. Off by default because Telnyx adds an automated-call announcement before spoken words |

The last five are env defaults; the admin can change them in **Settings**, and the saved value wins.

## How it behaves

- **Webhook** `POST /api/telnyx` verifies the ed25519 signature (and a 5-minute timestamp window); unsigned requests get 401. On `call.initiated` it answers and stores the call; on `call.answered` it says "One moment please" and holds quietly; `call.hangup` closes the call and dismisses notifications.
- **Routing**: users who flipped *I'm expecting someone* (default 45 min; clears after the first door they open) are pushed first. If nobody is expecting, everyone is. After `ESCALATE_AFTER` seconds, or when someone taps **Not mine**, everyone else is pushed too. Everyone not currently being asked gets a silent, low-priority ping. Per-user quiet hours downgrade pushes to silent unless that person is expecting.
- **Open**: `POST /api/open` claims the call with one atomic `UPDATE ... WHERE status='ringing'`, so the first tap wins and the tone is sent once. If Telnyx fails, the claim is released so someone can retry. Other phones update live (SSE, with polling fallback) and their notification is replaced with "Opened by …".
- **Fallback**: after `BACKUP_TIMEOUT`, the held call is transferred (bridged) to `FALLBACK_NUMBER`.
- **Auto-open**: 10/20/30/60 minutes, announced to everyone, countdown banner with Cancel on every device, re-checked 2 seconds after "One moment" so a cancel still wins, never persists past its expiry.
- **iOS** notifications can't show buttons, so every notification opens the Open screen. Android also gets an **Open door** action.
- **Security**: sessions are per-device cookies (stored hashed); every API route except the Telnyx webhook needs one; `/api/open` and invite redemption are rate-limited; invites are single-use and expiring; admins can revoke devices.

## Project layout

`app/` screens and API routes · `lib/routing.ts` pure routing rules · `lib/calls.ts` claim/escalate/fallback state machine · `lib/autoopen.ts` · `lib/telnyx.ts` signature + Call Control · `public/sw.js` service worker · `scripts/simulate-call.ts` dev simulator · `tests/` Vitest suite (real SQL via PGlite).

## License

MIT, see `LICENSE`. UI uses Tailwind CSS and daisyUI (both MIT).
