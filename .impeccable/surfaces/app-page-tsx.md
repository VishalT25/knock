---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Surface brief: Knock app (Open, Log, Household, Settings, Setup)

Mode: Operate. Mobile-first installable PWA, one-handed, hurried. Code-led; Tailwind v4 + daisyUI 5 for controls.
History: build 1 (green exit-sign) rejected; build 2 (Pocket Operator, flat, hard outlines) rejected as "jarring and harsh" with an LCD that "doesn't match the rest". This is a REDESIGN: both old looks are evidence of function only. Honest limit: a PWA can imitate iOS Liquid Glass (backdrop blur, rim light, specular highlights, spring motion) but cannot use native components; true lens refraction is Chromium-only so iOS Safari gets blur + highlights.

## Direction contract

THESIS: A native-feeling iOS Liquid Glass app: translucent layered glass floating over a soft warm gradient, with one orange light behind the Open key that comes alive when the door buzzes. It refuses hard outlines, flat opaque cards and loud contrast; softness and depth come from light, not borders.
OWN-WORLD: Backdrop: calm warm-white to peach wash (light) / deep brown-charcoal (dark), with a soft orange orb that glows on a buzz. Glass: blurred, saturated, tinted translucent surfaces with a 1px bright rim, an inner top highlight and a soft offset shadow; radii 1.25-2rem. Orange glass key with specular highlight is the hero and the only saturated object. The status readout keeps the dot-matrix Doto text but is now a glass panel in the same material (no green LCD). Type: system UI font (SF on Apple) with Hanken Grotesk fallback; sentence-case labels. Light/dark switchable (System / Light / Dark).
STORY: Buzz arrives; the backdrop glow warms, the glass readout says AT THE DOOR with a timer, the orange glass key invites one tap. Tap: key fills, then OPENED BY MAYA. Other screens are calm glass lists in the same light.
FIRST VIEWPORT: 390x844. Header (Knock + household, theme button, live chip), glass push-off notice if needed, glass readout panel, big orange glass key (about 40% height) + glass NOT MINE pill, floating glass tab bar pill at the bottom with a selected capsule.
FORM: user-pinned: "that liquid glass look, like a fully native ios, liquid glass kinda look", backdrop "soft warm gradient, orange glow... the key glows when the door buzzes. Dark mode goes deep brown-charcoal", and "keep the LCD idea" (matched to the rest). Hero behavior from the original request: "The Open screen is the hero: one huge, unmistakable button, immediate state feedback (waiting / opening / opened by X / not opened), and haptics where supported." seed: none (pinned)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
