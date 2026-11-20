# Knock design system

Direction: **iOS-style Liquid Glass over a warm gradient.** Translucent layered glass floats over a soft warm wash; one orange light sits behind the Open key and comes alive when the door buzzes. User-pinned: "that liquid glass look, like a fully native ios, liquid glass kinda look", backdrop "soft warm gradient, orange glow", dark mode "deep brown-charcoal", and keep the LCD idea but make it match.

Honest limit: a PWA can imitate Liquid Glass (backdrop blur, rim light, specular highlight, spring motion) but cannot use native iOS components, and true lens refraction is Chromium-only, so iOS Safari gets blur + highlights.

## Themes (daisyUI `knock-light` / `knock-dark` in `app/globals.css`)
- Switchable: Auto / Light / Dark in Settings, plus a one-tap sun/moon button in the top bar. Saved in `localStorage` (`knock-theme`), applied by an inline boot script before first paint (no flash). Auto follows the OS.
- Light: warm white to peach wash. Dark: deep brown-charcoal (`base-100 oklch(0.15 0.012 50)`).
- **Orange** `primary` (`0.7 0.19 45`): the Open key, selected chips, active tab marker, live status text. The only saturated object, plus yellow `accent` for "something changed" (auto-open banner, missed/backup/error readout, warning icon chip) and green only for the opened state.
- Glass tokens live in the themes: `--glass-tint`, `--glass-rim`, `--glass-hi`, `--glass-edge`, `--glass-shadow`, backdrop `--bg-a/b/c`, orb `--orb`.

- **Orange ink** (`--orange-ink`): a darker orange (light mode) used for orange *text and icons* on glass, since the bright key orange measures 2.65:1 there. The bright orange stays for fills only.

## Material
`.glass` family (panel, notice, chip, readout, tab bar, secondary key): tinted translucent fill, `backdrop-filter: blur(22px) saturate(1.7)`, 1px bright rim, inner top highlight, soft offset shadow. Fallbacks: solid surface when `backdrop-filter` is unsupported or `prefers-reduced-transparency` is set.

## Type
System UI font (SF on Apple devices), Hanken Grotesk fallback, sentence-case labels. Doto (dot-matrix) only for the status readout, countdowns and invite codes.

## Components
- **Open screen:** glass readout (status tag, dot-matrix line, one sentence) above one huge orange glass key with a specular sheen; idle/missed/backup collapse the key to a compact glass row; opened turns green. Floating glass "Not mine" pill. A fixed `.glow` orb behind everything breathes while ringing and turns green when opened.
- Floating glass tab bar (pill) with a selected capsule; pill segmented controls; 44px+ targets throughout.
- daisyUI toggle/input/btn re-themed; icons from the 2px-stroke set in `components/Icons.tsx`.

## Live glass and motion
- Press feedback follows the finger: `Boot` sets `data-pressed` plus `--px/--py` on the pressed control, so a soft highlight chases the touch point. Big keys press in to 0.955 and settle back on a gentle `linear()` spring (a hair of overshoot, like iOS); tabs swell to 1.12 like the dock while neighbours give way; chips and buttons squeeze to 0.94.
- The tab capsule is one element that slides between tabs (0.7s expo ease-out) and inflates while a tab is pressed.
- Routes and status changes rise in (fade, 10px lift, 4px blur to sharp). The expecting/auto-open controls sit behind one disclosure row that animates height with `grid-template-rows`.
- Idle shows a sleeping door (drifting z's, no text); the readout label is "Buzzer status" and the line is "Standby".

## Motion (base)
Smooth-settling press on keys and chips; key nudges while ringing, fills while opening; glow breathes on a buzz; readout cursor blinks. `prefers-reduced-motion` removes movement, loops and blur but keeps every state change visible as a short colour/opacity change.

## Verified
Headless-Chrome captures (390px dark/light, 1440px) of Open (idle, ringing, opened, missed), Log, Household, Settings, Setup checks, Join. Not verified: this Liquid Glass build has NOT had an independent finish review; real iOS Safari rendering; contrast of glass text over every backdrop state; setup test-call, push states, active auto-open banner, tiny phones.
