# Pret-main

ASCII-heavy React battle prototype built with Vite, TypeScript, canvas effects, and CRT styling.
The combat stack is split between battle state, orchestration, shared geometry, and pure rendering helpers.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Current Flow

```text
App
 ├─ text / transition shell
 └─ battle
    └─ BattlePage
       ├─ encounter  -> SkullEncounter
       ├─ intro
       └─ combat     -> BattleStage
```

   ## Combat Architecture

   - `BattlePage` owns battle rules, HP/MP/shield state, turn flow, logs, and combat animation requests.
   - `BattleStage` owns the live combat scene, DOM/canvas refs, input handling, potion drag/drop, and effect orchestration.
   - `widgets/battle-stage/lib/core.ts` holds shared types, fixed layout anchors, Bezier sampling, and coordinate helpers.
   - `widgets/battle-stage/lib/visuals.ts` holds pure canvas rendering, glyph deformation, overlay effects, and particle spawners.

   If a combat change is pure math, coordinate mapping, or visual rendering, it should usually land in `widgets/battle-stage/lib/core.ts` or `widgets/battle-stage/lib/visuals.ts` instead of growing `widgets/battle-stage/ui/BattleStage.tsx`.

## Current Combat Features

- Direct ASCII asset loading from `public/assets/new_hero_ascii.md` and `public/assets/new_enemy_ascii.md`.
- Canvas-rendered projectile combat with per-hit impact bursts and variable monster hit points.
- Monster hit deformation that pushes glyphs and tints letters in a localized red wave.
- Draggable health potion that can be dropped onto the player as a free one-time heal.
- ASCII HP heart and MP flask widgets with short-lived charge particles when values change.
- Animated shield overlays, slash sweeps, potion shatter particles, and CRT pulse feedback.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/App.tsx` | Top-level phase switching between non-battle and battle states. |
| `src/pages/battle/ui/BattlePage.tsx` | Owns battle state, turn resolution, logs, potion usage, and combat requests. |
| `src/widgets/battle-stage/ui/BattleStage.tsx` | Wires the combat scene together: input, refs, potion interaction, and effect orchestration. |
| `src/widgets/battle-stage/lib/core.ts` | Shared combat types, anchor maps, Bezier helpers, and scene-to-console coordinate math. |
| `src/widgets/battle-stage/lib/visuals.ts` | Pure text/canvas rendering helpers, monster glyph impact drawing, and particle/effect factories. |
| `src/entities/combat/*`, `src/entities/player/*`, `src/entities/monster/*`, `src/entities/spell/*`, `src/entities/equipment/*` | Combat domain rules split by responsibility into entity slices. |
| `src/widgets/resource-panel/ui/HeartHP.tsx` | Animated ASCII heart resource widget. |
| `src/widgets/resource-panel/ui/ManaFlask.tsx` | Animated ASCII mana flask resource widget. |
| `src/features/potion-use/ui/HealthPotion.tsx` | Small animated ASCII health potion used in combat. |
| `src/shared/ui/resource-charge-burst/ResourceChargeBurst.tsx` | Canvas-based resource change effect that reuses the monster charge motion pattern. |
| `src/shared/lib/ascii/useAsciiAsset.ts` | Loads pre-authored ASCII `.md` assets and trims annotation padding. |
| `src/app/styles/index.css` | Theme tokens and global animation keyframes. |

## Asset Notes

- `new_hero_ascii.md` and `new_enemy_ascii.md` are treated as source-of-truth combat sprites.
- `useAsciiAsset` trims surrounding whitespace and strips guide/annotation lines before rendering.
- The older image-to-ASCII hook still exists in the repo, but the battle scene now uses authored ASCII assets directly.

## Rendering Notes

- The central CRT console uses `@chenglou/pretext` for narrative layout and text displacement.
- Projectiles and larger scene particles render on a wider scene canvas that sits above the CRT layer.
- Player and monster sprites render as DOM `<pre>` blocks, with temporary sprite-local canvases used only while local deformation effects are active.
- Resource widgets use tiny local canvases so their charge effect stays locked to widget size.

## Render Layers

- DOM `<pre>` sprites keep the base player and monster ASCII stable.
- Sprite-local canvases handle temporary deformation, shield overlays, and potion hover displacement.
- The central CRT canvas renders console text, pulses, and text-layer reactions.
- The scene FX canvas handles projectiles, scatter particles, and hit bursts that need wider travel space.

## Extending Combat

- Add new turn logic or damage rules in `pages/battle/ui/BattlePage.tsx` and the relevant `entities/*` slice.
- Add new reusable coordinate or sampling helpers in `widgets/battle-stage/lib/core.ts`.
- Add new particle systems or canvas-only visuals in `widgets/battle-stage/lib/visuals.ts`.
- Keep `widgets/battle-stage/ui/BattleStage.tsx` focused on wiring those pieces together rather than holding new pure helper code.

## Stack

- React 19
- TypeScript 6
- Vite 8
- Tailwind CSS 4
- `@chenglou/pretext`
- Canvas 2D and WebCodecs-based encounter rendering
