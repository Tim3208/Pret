# Pret-main

ASCII-heavy React battle prototype built with Vite, TypeScript, canvas effects, and CRT styling.
The combat stack is split between page composition, battle flow state, shared geometry, and pure rendering helpers.

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
       ├─ pre-combat -> BattleEncounterSequence -> SkullEncounter / intro
       └─ combat     -> useBattleFlow -> BattleStage
```

## Combat Architecture

- `BattlePage` owns scene composition, ASCII asset loading, and victory/defeat copy selection.
- `widgets/battle-loading/ui/BattleLoadingPanel.tsx` owns the combat asset loading screen shown before the live battle widget mounts.
- `widgets/battle-outcome/ui/BattleOutcomePanel.tsx` owns the victory/defeat result screen presentation.
- `widgets/encounter-scene/ui/BattleEncounterSequence.tsx` owns the pre-combat encounter and intro sequence composition.
- `widgets/battle-stage/model/useBattleFlow.ts` owns battle state progression, turn flow, logs, potion usage, and combat animation scheduling.
- `widgets/battle-stage/model/resolvePlayerAction.ts` owns player action resolution branches so combat rule edits do not accumulate inside the hook body.
- `widgets/battle-stage/model/resolveMonsterTurn.ts` owns monster turn resolution branches so turn damage and timing edits do not accumulate inside the hook body.
- `widgets/battle-stage/model/useBattleStageCanvasLoop.ts` owns the RAF canvas loop, console redraws, projectile travel, and sprite overlay rendering.
- `widgets/battle-stage/model/usePlayerAsciiPresentation.tsx` owns the player ASCII markup, equipment tint composition, canvas metric syncing, and render refs.
- `widgets/battle-stage/model/useMonsterAsciiPresentation.ts` owns the monster ASCII tone/metric syncing, render refs, and localized impact canvas state.
- `widgets/battle-stage/model/useBattleStageEffects.ts` owns heal/shield/death effect bookkeeping plus sprite effect registration.
- `features/battle-command-input/ui/BattleCommandInput.tsx` owns command selection, target picking, prompt parsing, and keyboard navigation.
- `features/potion-use/model/usePotionUseInteraction.ts` owns potion home/rest/drag state, hover detection, hover displacement state, and drop resolution.
- `features/potion-use/ui/PotionUseButton.tsx` owns the draggable potion button shell, tooltip, and orbit presentation.
- `widgets/battle-log/ui/BattleLogPanel.tsx` owns the central CRT console shell and canvas mounting point.
- `widgets/resource-panel/ui/ResourcePanel.tsx` owns the HP/MP panel composition around the existing ASCII widgets.
- `widgets/battle-stage/ui/BattleEquipmentOverlay.tsx` owns the player equipment hotspot and tooltip overlay.
- `widgets/battle-stage/ui/BattleMonsterPanel.tsx` owns the monster sprite block, intent overlay canvas placement, and HP bar rendering.
- `BattleStage` owns live combat scene composition, DOM refs, potion consume effect callbacks, and projectile registration while consuming shared helpers from `widgets/battle-stage/lib/*`.
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
| `src/pages/battle/ui/BattlePage.tsx` | Composes encounter, intro, combat, victory, and defeat screens. |
| `src/widgets/battle-loading/ui/BattleLoadingPanel.tsx` | Renders the combat loading message while ASCII assets are still being prepared. |
| `src/widgets/battle-outcome/ui/BattleOutcomePanel.tsx` | Renders the victory and defeat result panel markup from page-selected copy. |
| `src/widgets/encounter-scene/ui/BattleEncounterSequence.tsx` | Composes the pre-combat encounter animation and typewriter intro prompt. |
| `src/widgets/battle-stage/model/useBattleFlow.ts` | Owns battle state, turn progression, logs, potion usage, and combat animation scheduling. |
| `src/widgets/battle-stage/model/resolvePlayerAction.ts` | Resolves player action branches into state updates and combat animation requests. |
| `src/widgets/battle-stage/model/resolveMonsterTurn.ts` | Resolves monster turn branches into shield/damage updates, logs, and animation timing. |
| `src/widgets/battle-stage/model/useBattleStageCanvasLoop.ts` | Runs the combat RAF loop for console text, projectile travel, sprite-local canvases, and overlay effects. |
| `src/widgets/battle-stage/model/usePlayerAsciiPresentation.tsx` | Owns player ASCII markup generation, tint mapping, and canvas metric/render refs. |
| `src/widgets/battle-stage/model/useMonsterAsciiPresentation.ts` | Owns monster ASCII tone calculation, metric syncing, render refs, and impact band canvas state. |
| `src/widgets/battle-stage/model/useBattleStageEffects.ts` | Owns heal detection, shield persistence, monster death timing, and sprite effect refs. |
| `src/features/battle-command-input/ui/BattleCommandInput.tsx` | Owns command selection, target confirmation, prompt parsing, and keyboard navigation. |
| `src/features/potion-use/model/usePotionUseInteraction.ts` | Owns potion drag state, home/rest positioning, hover detection, hover displacement state, and drop resolution. |
| `src/features/potion-use/ui/PotionUseButton.tsx` | Renders the draggable potion shell, orbit animation, and tooltip around the potion asset. |
| `src/widgets/battle-log/ui/BattleLogPanel.tsx` | Owns the CRT console shell and the mounted battle log canvas container. |
| `src/widgets/resource-panel/ui/ResourcePanel.tsx` | Composes the HP and MP widgets into the battle resource HUD. |
| `src/widgets/battle-stage/ui/BattleEquipmentOverlay.tsx` | Renders equipment hotspots and tooltips on top of the player ASCII sprite. |
| `src/widgets/battle-stage/ui/BattleMonsterPanel.tsx` | Renders the monster sprite block, intent overlay canvas, and HP bar. |
| `src/widgets/battle-stage/ui/BattleStage.tsx` | Wires the combat scene together: refs, potion drag state, and effect orchestration. |
| `src/widgets/battle-stage/lib/core.ts` | Shared combat types, anchor maps, Bezier helpers, and scene-to-console coordinate math. |
| `src/widgets/battle-stage/lib/visuals.ts` | Pure text/canvas rendering helpers, monster glyph impact drawing, and particle/effect factories. |
| `src/entities/combat/*`, `src/entities/player/*`, `src/entities/monster/*`, `src/entities/spell/*`, `src/entities/equipment/*` | Combat domain rules split by responsibility into entity slices. |
| `src/widgets/resource-panel/ui/HeartHP.tsx` | Animated ASCII heart resource widget. |
| `src/widgets/resource-panel/ui/ManaFlask.tsx` | Animated ASCII mana flask resource widget. |
| `src/features/potion-use/ui/HealthPotion.tsx` | Small animated ASCII health potion body used inside the potion interaction feature. |
| `src/shared/ui/resource-charge-burst/ResourceChargeBurst.tsx` | Canvas-based resource change effect that reuses the monster charge motion pattern. |
| `src/shared/lib/ascii/useAsciiAsset.ts` | Loads pre-authored ASCII `.md` assets and trims annotation padding. |
| `src/app/styles/index.css` | Theme tokens and global animation keyframes. |

## Asset Notes

- `new_hero_ascii.md` and `new_enemy_ascii.md` are treated as source-of-truth combat sprites.
- `useAsciiAsset` trims surrounding whitespace and strips guide/annotation lines before rendering.
- Legacy image-to-ASCII conversion code and unused PNG source sprites were removed after the FSD audit.
- The battle scene now uses authored ASCII assets directly for combatants.

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

- Add new turn scheduling in `widgets/battle-stage/model/useBattleFlow.ts`, add new player action rule branches in `widgets/battle-stage/model/resolvePlayerAction.ts`, and add new monster action rule branches in `widgets/battle-stage/model/resolveMonsterTurn.ts` with the relevant `entities/*` slice.
- Add new command selection or prompt parsing rules in `src/features/battle-command-input/ui/BattleCommandInput.tsx`.
- Add new potion drag/drop, hover, or player-sprite displacement rules in `src/features/potion-use/model/usePotionUseInteraction.ts`.
- Add new resource HUD composition or layout changes in `src/widgets/resource-panel/ui/ResourcePanel.tsx`.
- Add new pre-combat encounter or intro presentation changes in `src/widgets/encounter-scene/ui/BattleEncounterSequence.tsx`.
- Add new combat loading presentation changes in `src/widgets/battle-loading/ui/BattleLoadingPanel.tsx`.
- Add new victory or defeat result presentation changes in `src/widgets/battle-outcome/ui/BattleOutcomePanel.tsx`.
- Add new player ASCII sprite markup or canvas metric rules in `src/widgets/battle-stage/model/usePlayerAsciiPresentation.tsx`.
- Add new monster ASCII impact/metric rules in `src/widgets/battle-stage/model/useMonsterAsciiPresentation.ts`.
- Add new shield/heal/death sprite-effect rules in `src/widgets/battle-stage/model/useBattleStageEffects.ts`.
- Add new RAF canvas orchestration or projectile/render loop changes in `src/widgets/battle-stage/model/useBattleStageCanvasLoop.ts`.
- Add new reusable coordinate or sampling helpers in `widgets/battle-stage/lib/core.ts`.
- Add new particle systems or canvas-only visuals in `widgets/battle-stage/lib/visuals.ts`.
- Keep `src/pages/battle/ui/BattlePage.tsx` focused on scene composition and keep `widgets/battle-stage/ui/BattleStage.tsx` focused on wiring those pieces together rather than holding new pure helper code.

## Stack

- React 19
- TypeScript 6
- Vite 8
- Tailwind CSS 4
- `@chenglou/pretext`
- Canvas 2D and WebCodecs-based encounter rendering
