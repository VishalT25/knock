# Knock

Open your building's door from your phone. A self-hosted, open-source (MIT) PWA door buzzer for one household.

**Website and full guide: [knockbuzzer.app](https://knockbuzzer.app)**

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

## Set it up

**The full step-by-step guide, with screenshots, is at [knockbuzzer.app/docs](https://knockbuzzer.app/docs).** It covers the Telnyx account, which is the longest part, and the mistakes people actually make. The short version:

1. [Check your intercom](https://knockbuzzer.app/docs/will-it-work) can work (it must call a phone number and unlock on a key press).
2. **Deploy** with one click:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVishalT25%2Fknock&project-name=knock&repository-name=knock&env=SETUP_TOKEN&envDescription=Pick+any+long+password.+You+type+it+once+on+the+first-run+screen+so+nobody+else+can+claim+your+Knock.&envLink=https%3A%2F%2Fknockbuzzer.app%2Fdocs%2Fdeploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

   Vercel copies the code into your GitHub, attaches a free Neon database and asks for one value, `SETUP_TOKEN`: a password you invent. Notification keys are generated for you on first use. If the database isn't attached automatically, add **Neon** under your project's **Storage** tab and redeploy.
3. [Set up Telnyx](https://knockbuzzer.app/docs/telnyx): create the account, **upgrade it to Paid** by adding about $5 of credit (a Trial account only accepts calls from your verified number, so your building would be rejected), buy a number, create a Call Control application with the webhook `https://<your-app>/api/telnyx` (API v2), and attach an outbound voice profile and your number.
4. Add four environment variables in Vercel and **redeploy**:
   `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_NUMBER` (like `+14155550123`).
5. Open your app, run first-time setup (household, checks, test call), invite your roommates, and ask your building to call your Knock number.

> The Deploy button only works for other people if this repository is **public**. A private repository can only be cloned by its owner.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | embedded dev DB | Postgres URL (set by the Neon integration on Vercel) |
| `SETUP_TOKEN` | **yes in production** | none | The password first-run setup requires, so strangers can't claim a fresh deployment |
| `TELNYX_API_KEY` | yes | | Server-side only, never sent to the browser |
| `TELNYX_PUBLIC_KEY` | yes | | Verifies the signature on Telnyx webhooks |
| `TELNYX_CONNECTION_ID` | yes | | The Call Control application's ID |
| `TELNYX_NUMBER` | yes | | Your Knock number in international format. Shown in Settings; used as caller ID for test and backup calls |
| `UNLOCK_DIGIT` | no | `9` | Tone sent to open the door |
| `ESCALATE_AFTER` | no | `8` | Seconds before everyone is notified loudly |
| `BACKUP_TIMEOUT` | no | `20` | Seconds before the backup number is dialled |
| `FALLBACK_NUMBER` | no | none | Rings if nobody opens; bridged to the held call |
| `AUTO_OPEN_MAX_MINUTES` | no | `60` | Longest auto-open window (hard cap 60) |
| `GREETING` | no | off | `1` makes Knock say "One moment please" to the visitor. Off by default: Telnyx adds an automated-call announcement before spoken words |
| `APP_URL` | no | auto on Vercel | Public address, used by the setup wizard's webhook check |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | generated | Your own web-push keys. If you leave them out, Knock generates a pair on first use and stores it in the database. If you set one, set both (`VAPID_SUBJECT` like `mailto:you@example.com`) |

The behaviour settings (digit, timings, fallback number, auto-open ceiling, greeting) can also be changed in the app's **Settings**; the saved value wins over the environment default.

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
