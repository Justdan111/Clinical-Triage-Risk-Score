# NEWS2 Triage: design system

Status: **approved 2026-11-15, with changes** (UI/UX redesign pass, after Day 4). Nothing here changes the API or the
NEWS2 logic. The server stays the only place a score is computed.

## 1. Principles

1. **Calm before clever.** Clinical-modern: big rounded cards, generous spacing, soft
   depth. Playfulness lives in *motion and feedback* (springs, a pop, a tick), never in
   the outcome.
2. **Colour is never the only signal.** Every band shows an **icon + text label + colour**.
   Every error shows a **message + border + motion**.
3. **No reward for any outcome.** No confetti, trophies, streaks, badges, sparkles or
   "success" styling tied to the result. Low risk is shown as *information*, not a win: same
   layout, same weight, no celebratory haptic.
4. **Motion explains, then gets out of the way.** Every animation shows cause and effect
   (a field filled, a score built from its parts) and finishes in ≤ 1.8 s. With Reduce
   Motion on, movement becomes simple fades.
5. **Accessible by construction.** 4.5:1 text contrast in both themes (tested), 3:1 for
   graphics, 44 pt touch targets, labels on every control, and layouts that hold at the
   largest Dynamic Type size.

## 2. Colour tokens

One token set, two themes, following the system setting (`userInterfaceStyle:
"automatic"`). Components only ever reference **token names**, never hex values.

### Neutrals and UI

| Token | Light | Dark | Used for |
|---|---|---|---|
| `bg` | `#F3F5F8` | `#0B1017` | Screen background |
| `surface` | `#FFFFFF` | `#141B24` | Cards |
| `surfaceMuted` | `#EBEFF4` | `#1C2530` | Input wells, inactive chips, stepper buttons |
| `border` | `#DCE2EA` | `#26313E` | Hairlines (decorative, not a text pair) |
| `text` | `#101828` | `#F2F5F9` | Primary text, numbers |
| `textMuted` | `#475467` | `#B3BECB` | Units, secondary text |
| `textSubtle` | `#5F6B7A` | `#9AA6B4` | Placeholders, captions |
| `primary` | `#2346C8` | `#8AA8FF` | Progress ring, focus, submit button |
| `onPrimary` | `#FFFFFF` | `#0B1017` | Text on `primary` |
| `primaryMuted` / `onPrimaryMuted` | `#E6ECFD` / `#1A3699` | `#1C2A4D` / `#C9D6FF` | Selected chip |
| `error` | `#B42318` | `#FF8B7E` | Error border and message text |
| `errorSurface` / `onErrorSurface` | `#FEF0EE` / `#8F1A12` | `#3A1512` / `#FFD3CD` | Error banner |
| `warnSurface` / `onWarnSurface` | `#FFF4DB` / `#5B3A00` | `#2E2410` / `#FFD98A` | Disclaimer |

### Bands

Each band has four tokens. **strong** is a filled surface (chip, label pill) and **onStrong**
is the text on it. **tint** is the result-screen background and **onTint** is the text on it.
**graphic** is a separate token for strokes and markers (gauge ring, scale marker, driver
bars). In light mode, amber and orange are too pale to read as lines (1.5:1 and 1.9:1 on
their tints), so `graphic` is darker there.

| Band | Icon | | Light | Dark |
|---|---|---|---|---|
| **Low** (green) | check in circle | strong / onStrong | `#13784A` / `#FFFFFF` | `#45D08A` / `#04210F` |
| | | tint / onTint | `#E6F5EC` / `#0B4A2D` | `#0F2A1E` / `#B9F0D1` |
| | | graphic | `#13784A` | `#45D08A` |
| **Red-flagged** (amber) | flag | strong / onStrong | `#F5C53D` / `#2A1E00` | `#F7CF55` / `#231900` |
| | | tint / onTint | `#FFF6DA` / `#5C4300` | `#2C250C` / `#FBE6A2` |
| | | graphic | `#A07000` | `#F7CF55` |
| **Medium** (orange) | warning triangle | strong / onStrong | `#F59A3E` / `#2B1500` | `#FFA556` / `#251200` |
| | | tint / onTint | `#FFEEDD` / `#7A3A00` | `#2F1E0E` / `#FFD2A8` |
| | | graphic | `#B35400` | `#FFA556` |
| **High** (red) | alert octagon | strong / onStrong | `#C42B2B` / `#FFFFFF` | `#FF6B6B` / `#1F0505` |
| | | tint / onTint | `#FDE8E8` / `#8A1414` | `#331414` / `#FFC9C9` |
| | | graphic | `#C42B2B` | `#FF6B6B` |

Band icons move from text glyphs (✓ ⚑ ▲ ‼) to **SVG icons** (react-native-svg). That removes
the emoji-rendering risk entirely and lets the icon stroke use `onStrong`.

### Measured contrast (WCAG 2.x)

Computed from the hex values above, not estimated. The extended unit test will assert
every pair, in **both** themes.

| Pair (text on background) | Light | Dark |
|---|---|---|
| text on bg / surface / surfaceMuted | 16.25 / 17.75 / 15.37 | 17.45 / 15.85 / 14.16 |
| textMuted on bg / surface / surfaceMuted | 7.04 / 7.69 / 6.66 | 10.12 / 9.20 / 8.21 |
| textSubtle on surface / surfaceMuted | 5.43 / 4.70 | 7.00 / 6.26 |
| onPrimary on primary | 7.55 | 8.29 |
| onPrimaryMuted on primaryMuted | 8.75 | 9.78 |
| error on surface / bg | 6.57 / 6.02 | 7.63 / 8.40 |
| onErrorSurface on errorSurface | 8.14 | 11.92 |
| onWarnSurface on warnSurface | 9.37 | 11.30 |
| onStrong on strong (low / red / med / high) | 5.51 / 10.07 / 7.91 / 5.63 | 8.66 / 11.57 / 9.24 / 6.99 |
| onTint on tint | 9.17 / 8.61 / 7.62 / 8.16 | 12.00 / 12.30 / 11.45 / 11.55 |
| textMuted on tint | 6.82 / 7.12 / 6.78 / 6.55 | 8.13 / 8.09 / 8.49 / 8.91 |
| **graphic** on tint (non-text, ≥ 3:1) | 4.89 / 4.04 / 4.43 / 4.80 | 7.77 / 10.17 / 8.20 / 6.05 |

Lowest text pair: **4.70:1** (light `textSubtle` on `surfaceMuted`, placeholders only).

## 3. Typography

**Plus Jakarta Sans** (`@expo-google-fonts/plus-jakarta-sans`, loaded with `useFonts`, which
works in Expo Go; the `expo-font` *config plugin* does not). I parsed the font files to
confirm they include the `tnum` feature, so **every vital, score, points chip and
count-up** uses `fontVariant: ['tabular-nums']`. Digits keep the same width, so numbers
don't jitter while counting up. **The splash screen stays up until the fonts have loaded.**
If loading fails, the splash hides anyway and the app uses the system font, so a font
problem never blocks the app.

| Role | Size / line height | Weight | Notes |
|---|---|---|---|
| `scoreXL` | 56 / 60 | ExtraBold 800 | Number inside the gauge. Tabular. Capped at 1.3× so it stays inside the ring; the total is repeated as scalable text below. |
| `bandLabel` | 36 / 42 | ExtraBold 800 | **Keeps the 1.5× cap** |
| `numericInput` | 32 / 38 | Bold 700 | Tabular |
| `title` | 24 / 30 | Bold 700 | Section and card headings |
| `heading` | 18 / 24 | SemiBold 600 | Vital card name |
| `body` | 16 / 22 | Medium 500 | |
| `label` | 14 / 18 | SemiBold 600 | Units, chip text, captions above values |
| `caption` | 13 / 18 | Medium 500 | Disclaimer body, helper text |

All text except the two capped roles scales with Dynamic Type without limit.

## 4. Spacing, radius, elevation

**Spacing (4-pt grid):** `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40`.
Screen gutter 20, gap between cards 16, card padding 20.

**Radius:** `sm 12` (stepper buttons, small chips) · `md 16` (inputs) · `lg 20` (vital
cards) · `xl 24` (result hero card) · `2xl 28` (submit button, bottom sheet edge) ·
`pill 999` (chips, points badges).

**Elevation.** Shadows only read on light backgrounds, so dark mode uses a 1 px `border`
plus a slightly lighter surface instead.

| Level | Light | Dark | Used for |
|---|---|---|---|
| `e0` | none | none | Flat chips, rows |
| `e1` | shadow `#101828`, opacity 0.06, radius 16, y 6; Android elevation 2 | 1 px `border` | Vital cards, driver cards |
| `e2` | opacity 0.10, radius 24, y 10; Android elevation 6 | 1 px `border` + `surfaceMuted` | Result hero card, submit footer |

## 5. Motion

All animations run on the UI thread (Reanimated 4 worklets). Shared values drive styles;
JS-thread state never drives frame-by-frame animation.

### Durations and easing

| Token | ms | Easing | Used for |
|---|---|---|---|
| `instant` | 100 | linear | Pressed-state opacity |
| `fast` | 160 | `out(quad)` | Error border colour, chip fill |
| `base` | 240 | `out(cubic)` | Fades, message fade-in |
| `slow` | 400 | `inOut(cubic)` | Result background tint transition |
| `countUp` | 900 | `out(cubic)` | Gauge fill and number count-up (same curve, in sync) |
| `shimmer` | 1200 (loop) | linear | Loading sweep |

### Springs (Reanimated `withSpring` configs)

| Name | damping / stiffness / mass | Feel | Used for |
|---|---|---|---|
| `snappy` | 18 / 260 / 1 | Quick, no wobble | Chip select, toggle thumb, submit button arrival |
| `gentle` | 20 / 140 / 1 | Soft settle | Progress ring, scale-bar marker |
| `pop` | 9 / 320 / 0.8 | One small overshoot | Card "pop" (scale 1 → 1.03 → 1) when a field becomes valid |
| `label` | 14 / 180 / 1 | Confident landing | Band label (scale 0.85 → 1, fade in) |

**Shake** (server field error): translateX `0 → -8 → 8 → -6 → 6 → 0` over 320 ms, once.
The border goes to `error` over `fast`, and the message fades in over `base`.

### Result reveal choreography (from mount)

The answer comes first: the band is readable within about 0.4 s. The detail that explains
it builds up afterwards.

| t (ms) | What happens |
|---|---|
| 0 | Screen reader announcement fires immediately with the **full** result. It does not wait for the animation. |
| 0–400 | Background crossfades from `bg` to the band `tint` (`slow`). **At the same time** the band icon and label spring in (`label`) and land by about 350 ms. Warning haptic for red_flagged, medium and high as the label lands; **none for low**. |
| 450–1350 | Gauge arc fills from 0 to total/20 while the number counts 0 → total (`countUp`) |
| 1400 | Scale-bar marker springs to its position (`gentle`). For red_flagged, the "scored 3" flag appears |
| 1550 + 90·i | Driver cards stagger in (fade + 12 pt rise), points chip pops (`pop`) |
| ≤ 2000 | Done. Nothing loops afterwards. |

**Tap anywhere to skip.** A tap during the reveal cancels the remaining animations and jumps
straight to the final state: full gauge, final number, marker in place, every driver
visible. The warning haptic fires once, either when the label lands or on skip, whichever
comes first. The "Back to vitals" button stays tappable throughout.

### Reduced motion (`useReducedMotion()`)

- No translate, scale, shake or stagger. Every entrance becomes a 160 ms opacity fade.
- **The count-up is skipped**: the final number shows at once, and gauge and marker are set to their final positions.
- Errors still change border colour and show the message (no shake).
- The screen transition becomes a fade.
- Haptics are unchanged (they aren't motion).

### Screen transition

Native stack `slide_from_right` on both platforms (back slides out to the right).
`fade` when Reduce Motion is on.

## 6. Haptics (`expo-haptics`)

| Moment | Haptic |
|---|---|
| A field changes from empty or invalid to filled | `impactAsync(Light)`, once per change, never on every keystroke |
| Consciousness chip or oxygen toggle chosen | `selectionAsync()` |
| Submit pressed (7 of 7) | `impactAsync(Medium)` |
| Dimmed submit pressed (fewer than 7) | `impactAsync(Light)`. Focus moves to the **first empty field** and screen readers hear "N of 7 vitals entered". |
| Result is red_flagged, medium or high | `notificationAsync(Warning)` as the band label lands |
| Result is low | **none** |

## 7. Screens

**Form**
- **Header:** title, plus a **progress ring** showing "x of 7" (spring `gentle`).
- **Vital cards** for respiration rate, SpO₂, systolic BP, pulse and temperature. Each has an SVG icon, a name, a large tabular input, the unit, and − / + steppers (44 pt). Steps are 1, or 0.1 °C for temperature.
  - Icons: lungs (respiration), droplet (SpO₂), **gauge dial** (systolic BP), **heart with a pulse line** (pulse), thermometer (temperature), brain (consciousness). Every vital has a distinct shape.
- **Consciousness card** (brain icon) with five animated chips.
- **Oxygen card** with an animated toggle.
- **Disclaimer card** (styled with `warnSurface`), always visible on the screen.
- **Submit button** in the keyboard-safe footer from Day 4.
- While a request is in flight, a **shimmer** sweeps the submit button and the cards dim and lock. There is no bare spinner.

**Result**
- Band-tinted background.
- **Hero card:** gauge ring with the counted-up total, the band icon and label, and the RCP risk wording.
- **Scale bar:** 0–4 · 5–6 · 7+ with the marker. For red_flagged, the single parameter that scored 3 is marked by name.
- The one-sentence red-flag explanation, the minimal note when present, and the disclaimer card.
- **"How this score was built":** stacked bars, one segment per driver, animating into the total.
- Staggered **driver cards** with points chips.
- "Back to vitals".

## 8. Decisions (approved 2026-11-15)

1. **The oxygen toggle starts *unanswered*, not "Air".** The progress ring counts 7 inputs. A switch that defaults to "off" would count as filled before anyone looks at it, and a forgotten oxygen setting silently drops NEWS2's +2. So the card is a two-option animated toggle, **Air | Supplemental O₂**, with nothing selected until tapped. The same rule already applies to consciousness, which has no default.
2. **Steppers don't invent a starting value.** − and + are disabled until a number is typed, so they never pre-fill a "normal" value someone could accept without measuring. Steps are bounded below at 0 only; ranges stay the server's job.
3. **"Valid" on the form means filled and numeric**, the same light check as today. The ring and the haptic tick don't imply the value is in range; only the server decides that.
4. **The submit button is visible but inactive until 7 of 7.** It's dimmed, with the hint "Fill all 7 vitals". At 7 of 7 it springs to full colour and scale. Hiding it completely would make the screen less predictable for screen-reader users. **Pressing it while dimmed** gives a light haptic, moves focus to the first empty field, and announces "N of 7 vitals entered".
5. **The gauge numeral is capped at 1.3×** so it stays inside the ring. The total is also shown as normal scalable text ("NEWS2 total 7") under the band label.
6. **The "how this score was built" bars are on by default**, under the driver list. The points come straight from the server's `drivers`, so nothing is computed on the client.
7. **Vital icons are hand-drawn SVGs**, not an icon font, so the only new dependencies are the ones you listed. Systolic BP uses a **gauge dial** and pulse a **heart with a pulse line**, so the two are easy to tell apart.

## 9. Dependencies (all bundled in Expo Go for SDK 58)

Checked against `expo/bundledNativeModules.json`, the versions Expo Go ships:
`react-native-reanimated` 4.7.1 (with `react-native-worklets` 0.13.0) · `react-native-gesture-handler`
~3.3.0 · `react-native-svg` 15.16.0 · `expo-haptics` ~58.0.8 · `expo-linear-gradient` ~58.0.4 ·
`expo-font` ~58.0.12. `@expo-google-fonts/plus-jakarta-sans` 0.4.2 contains only JavaScript and
font files. Everything is installed with `npx expo install`, and nothing needs a development build.

## 10. Adjustments made during the visual review

Found on simulator screenshots and screen recordings; all are now in the code.

- **Scale-bar marker** stays invisible until it starts moving. Otherwise it showed the total
  parked at 0, which read as "Low", for about a second.
- **The disclaimer card has a hairline border** (`onWarnSurface` at 25% opacity). On the
  red-flagged tint, its amber surface was almost the same colour as the background.
- **A server field error scrolls the first errored card into view.** The message had been
  hidden below the footer.
- **Input placeholder is "Enter"**, not "–", which looked like the − stepper button next to it.
- **Largest text size:**
  - At `fontScale ≥ 1.5`, the progress header stacks the title under the ring ("Patie/nt" broke mid-word).
  - The "NEWS2" and "of 20" labels inside the gauge are capped at 1.3×, like the number, so they fit inside the ring.
  - The submit button label is capped at 1.6×. Uncapped, it took three lines and a fifth of the screen.
- **Lungs and flag icons were redrawn.** The first versions read as "db" and "F" at icon size.
