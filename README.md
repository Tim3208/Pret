# Pretext RPG — Architecture & Style Guide

A text-based RPG with procedural ASCII art, canvas-based combat, and CRT monitor aesthetics.  
Uses [@chenglou/pretext](https://www.npmjs.com/package/@chenglou/pretext) for text measurement and layout.

---

## Game Flow

```
App (root)
 ├─ "text"       → Campfire narration + player input (light the bonfire)
 ├─ "transition"  → Procedural ASCII fire animation + [venture forth] button
 └─ "battle"      → BattleScene (outside main CRT — has its own)
      ├─ "encounter" → SkullEncounter (fullscreen animated WebP → ASCII zoom-in)
      ├─ "intro"     → TypewriterText (enemy description) + [click to fight]
      └─ "combat"    → BattleCombat (3-column layout with projectiles)
```

---

## File Map

| File | Role |
|------|------|
| `App.tsx` | Root shell. Manages 3 phases: text → transition → battle. CRT wrapper for text/transition phases. |
| `App.css` | Global styles: `.crt`, `.crt-scanlines`, `.crt-noise`, `.crt-vignette`, `.input-form`, `.proceed-btn`, animations. |
| `BattleScene.tsx` | Battle orchestrator. Loads hero/enemy PNGs via `useImageToAscii`. Manages encounter → intro → combat flow, HP, turns. |
| `BattleCombat.tsx` | Core combat engine. Canvas (480×320) renders narrative text + projectiles. Player/monster sprites as DOM `<pre>` elements flanking a mini CRT. Uses `@chenglou/pretext` for word-wrapped text layout. |
| `SkullEncounter.tsx` | Animated WebP skull decoded frame-by-frame via `ImageDecoder` (WebCodecs). Progressive zoom (2×→15×) into skull's mouth with cubic ease-in. Grayscale ASCII. Fullscreen overlay. |
| `HeartHP.tsx` | ASCII heart (9×8 mask) with water wave animation. Fill level = HP ratio. Hover reveals `current/max`. 24 FPS. |
| `useImageToAscii.ts` | Hook: loads PNG → canvas → optional horizontal flip → brightness → ASCII ramp. Returns `string[]` lines. |
| `Battle.css` | All battle styles: heart, skull encounter, intro, combat layout, sprites, glitch effect, input. |
| `SwordEncounter.tsx` | *Legacy* — crossed swords encounter (replaced by SkullEncounter, not imported). |

---

## Visual Identity

### CRT Monitor Shell
Text/transition phases wrap in `.crt` with 3 overlay layers (scanlines, SVG noise, vignette).  
**Battle phase** renders **outside** the main CRT — `BattleCombat` has its own `.battle-crt` with identical overlays to avoid double-nesting.

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0d0d0d` | Page / canvas bg |
| Body text | `#bfbfbf` | Narration |
| Accent (gold) | `#ffaa00` | Prompt `>`, player input, keyword highlights |
| Fire core | `#fff8cc` → `#ffdd66` | Bonfire center |
| Heart | `#cc3344` | HP heart ASCII |

### Typography
- **Font**: `"Courier New", Courier, monospace` everywhere.
- **ASCII ramp**: `" .·:;=+*#%@"` (space → dense) for brightness mapping.
- Player input: gold `#ffaa00`, `border-bottom: 1px solid #555`, `>` prompt.

### Animation Rates
| Component | FPS | Notes |
|-----------|-----|-------|
| Bonfire | 12 | `requestAnimationFrame` throttled |
| SkullEncounter | 12 | `ImageDecoder` frame sampling |
| HeartHP | 24 | Wave animation |
| BattleCombat canvas | 60 | Projectile physics (no cap) |

---

## Architecture Details

### Rendering Pipeline (Bonfire)
```
Offscreen simCanvas (80×40, RGB-encoded zones)
  → R-channel zone detection (0=core, 40=mid, 80=outer, 100=wood, 120=embers)
  → brightness → ASCII ramp char
  → color/opacity/weight per zone
  → fillText() on displayCanvas (800×560)
  → mouse interaction: inner radius opacity, outer radius font-weight gradient
```

### Battle Combat Layout
```
.battle-combat-layout (flex row)
  ├─ .sprite-column.sprite-left   → player <pre> (ASCII from hero.png)
  ├─ .battle-crt-wrapper
  │    ├─ .battle-crt              → canvas 480×320 (narrative + projectiles)
  │    │    ├─ .crt-scanlines
  │    │    ├─ .crt-noise
  │    │    └─ .crt-vignette
  │    └─ .input-form.battle-input-row  → ">" prompt + text input
  └─ .sprite-column.sprite-right  → monster <pre> (ASCII from enemy.png)
```

- **Projectiles**: Enter from edges (−40px / W+40px), fly across canvas, trigger `.crt-glitch` when inside bounds.
- **Keywords**: `[bracketed]` words in narratives highlighted gold; typing any word fires a projectile.
- **Turn system**: Player types → projectile → 1.4s delay → monster auto-attacks → repeat.
- **Sprites**: 55-col ASCII from PNG, shake animation + red color shift on hit.

### Skull Encounter (WebCodecs)
```
fetch("combat.webp") → ImageDecoder → decode({ frameIndex })
  → VideoFrame → offscreen canvas → crop (zoom-dependent region) → sample to ASCII grid
  → grayscale ASCII render on display canvas
  → zoom: 2× → 15× (cubic ease-in, focus on mouth ~75% down)
  → fade-to-black in final 15% → auto-proceed to intro
```

### Heart HP
- 9×8 ASCII mask (`#` = fill, `.` = border)
- Water fill: sine wave surface (`~≈`) + gradient body (`░▒▓█`)
- Shimmer on deep cells, hover shows numeric HP

---

## Assets (`public/assets/`)

| File | Format | Usage |
|------|--------|-------|
| `hero.png` | PNG | Player character (wizard) → ASCII via `useImageToAscii` |
| `enemy.png` | PNG | Monster (skeleton archer) → ASCII via `useImageToAscii` |
| `combat.webp` | Animated WebP | Skull opening mouth → `SkullEncounter` frame decoding |
| `bonefire.png` | PNG | Unused |

---

## Tech Stack
- **React 19** + **Vite 8** + **TypeScript 6**
- **@chenglou/pretext** — `prepareWithSegments()` + `layoutWithLines()` for narrative text layout
- **WebCodecs ImageDecoder** — animated WebP frame-by-frame decoding
- **Canvas 2D** — all ASCII rendering (no WebGL)
- **CSS-only CRT** — scanlines, SVG noise filter, vignette, flicker
