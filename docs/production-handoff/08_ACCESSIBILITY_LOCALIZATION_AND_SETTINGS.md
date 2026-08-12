# Accessibility, Localization, and Settings

## Accessibility launch requirements

- Minimum 44 × 44 pt/dp interactive targets.
- Screen-reader labels for card rank/suit, lane number/score/capacity, current timer, power name/cost/state, opponent statuses, and result.
- Focus order follows score rail → current card → lanes 1–4 → powers → match controls.
- Color is never the only status signal. Pair color with icon, label, shape, or pattern.
- Dynamic text support on all non-gameplay screens. Gameplay offers Standard and Large HUD modes.
- High Contrast mode strengthens card edges, slots, timers, and status labels.
- Reduced Motion, Screen Flash Off, Haptics Off, and Particle Quality settings.
- Left-Handed mode mirrors power controls without changing lane numbering.
- Audio sliders: master, music, effects, voice/announcer.
- Subtitles/captions for spoken callouts.
- Pause or safe timeout accommodation in tutorial and practice; ranked timers remain equal for fairness.

## Color and cards

Suit information uses glyph and name, not red/black alone. Optional four-color deck: hearts red, diamonds blue, clubs green, spades black/white. All four must pass contrast against the selected card face.

## Localization

- Externalize all strings, plural rules, date/time, number, currency, and ordinal formatting.
- Avoid text baked into raster gameplay assets; overlay localized live text.
- Allow 35% expansion for German-like strings and support right-to-left layout on non-gameplay screens.
- Do not mirror card ranks, suit glyphs, lane numbering, or deterministic board coordinates in RTL.
- Launch language recommendation: English first, then Spanish, French, German, Brazilian Portuguese, Japanese, and Korean based on market plan.

## Settings persistence

Device-local immediately: audio, haptics, graphics, reduced motion, flash, handedness, HUD size.

Cloud-synced: language preference, notifications, privacy, equipped cosmetics, loadouts, and social permissions. Use last-write-wins with server timestamp except inventory and purchases, which are server authoritative.
