# PIXEL SWORD FIGHTER
## Complete Game Architecture & Implementation Plan
### Technology Stack: JavaScript · PixiJS · Matter.js · Vite

---

# 1. Executive Summary

Pixel Sword Fighter is a browser-based 2D pixel-art sword fighting game in the tradition of versus fighters (Street Fighter, Brawlhalla) crossed with action-platformer combat (Vanguard Knights, Rivals of Aether). Two combatants — drawn from a roster of four archetypal heroes, each wielding one of eight enchanted swords — fight across five hand-crafted arenas using a hybrid melee/magic combat system built on light/heavy/combo/air/dash attacks, blocking, parrying, and elemental special abilities (Fire, Ice, Lightning, Shadow, Dragon).

The product pillars are:

1. **Readable, weighty combat.** Every attack must communicate windup, active hit, and recovery clearly at 32–64px pixel-art scale, with hitstop, screen shake, and knockback selling impact.
2. **Build expression through sword choice.** The character defines the body, the sword defines the moveset modifiers, stat profile, and the elemental special/ultimate kit. 4 characters × 8 swords = 32 distinct play styles from a manageable content budget.
3. **Deterministic, testable simulation.** Combat math (damage, knockback, hitstun, parry windows) lives in pure, framework-agnostic functions so it can be unit tested, rebalanced via data files, and later run on a server for multiplayer without rewrites.
4. **60 FPS on mid-range laptops and Chromebooks.** PixiJS handles WebGL-batched 2D rendering; Matter.js handles broad-phase collision and ragdoll physics only (not core movement, which is custom-coded for tight platformer feel).
5. **Single-player complete, multiplayer-ready.** Phase 1 ships a full single-player experience (Story-less Arcade mode, 4 AI difficulties, local 2-player). The simulation is architected so a deterministic-lockstep or rollback netcode layer can be added later without touching gameplay code.

The system is built as an **Entity Component System (ECS)** on top of PixiJS for rendering and Matter.js for physics bodies, with all gameplay rules expressed as pure systems operating on data, enabling parallel development of characters, swords, and arenas as independent content packages.

---

# 2. Core Gameplay Loop

## 2.1 Session Loop (macro)

```
Main Menu → Character Select → Sword Select → Arena Select → Battle → Results → (Rematch / Menu)
```

## 2.2 Moment-to-Moment Loop (micro, repeats ~every 0.5–3s during a match)

```
Spacing/Movement → Threat Read (opponent windup) → Decision
   ├─ Attack (Light/Heavy/Combo/Air/Dash)
   ├─ Defend (Block/Parry)
   ├─ Reposition (Walk/Run/Jump/Dash/Roll)
   └─ Resource Spend (Magic Attack / Ultimate)
→ Resolution (hit/block/parry/whiff) → Stagger/Advantage State → repeat
```

## 2.3 Player Action Inventory

| Category | Actions | Resource Cost | Notes |
|---|---|---|---|
| Movement | Walk, Run, Jump, Double Jump, Dash, Roll | Stamina (Run/Dash/Roll) | Roll has i-frames; Dash has none but is faster |
| Offense | Light Attack, Heavy Attack, Combo Chain (3–5 hits), Air Attack, Dash Attack | Stamina (Heavy/Combo finishers) | Each sword remaps animation + damage/speed modifiers |
| Defense | Block, Parry, Counter-Attack | Stamina (Block chip), Parry has strict timing window | Successful parry opens Counter-Attack window |
| Magic | Fire / Ice / Lightning / Shadow / Dragon special move (one per sword's element) | Mana | Each sword grants exactly one elemental special + one Ultimate |
| Resource | Ultimate Attack | Ultimate Meter (charged by dealing/taking damage, landing parries) | One per sword, screen-impacting finisher |

## 2.4 Win Condition

Reduce opponent HP to 0 (KO), or have higher HP when the round timer (90s default) expires. Best of 3 rounds in versus modes.

---

# 3. Game Design Document (GDD)

## 3.1 Mechanics Summary

- **Stat-driven characters**: HP, Stamina, Mana, Move Speed, Strength (physical dmg mult.), Defense (dmg reduction), Crit Chance, Crit Multiplier, Weight (affects knockback resistance and fall speed).
- **Sword overlay**: each sword applies additive/multiplicative modifiers on top of base character stats, plus unlocks its element's special move and unique ultimate animation/effect.
- **Stamina gates movement-spam and heavy/combo-finisher attacks**, preventing infinite pressure; regenerates passively, faster when neutral/blocking, paused briefly after Heavy/Roll.
- **Mana gates magic specials**, regenerates slowly over time and on light-attack hits (small amount), encouraging weaving normals and magic rather than spamming either.
- **Ultimate Meter** fills from damage dealt (60%), damage taken (25%), and successful parries (15% weight, but high per-instance value to reward skillful defense). Caps at 100; Ultimate usable only at 100, consumes full bar.

## 3.2 Combat Pillars

1. **Footsies-first neutral**: walk speed, dash distance, and normal-attack range are tuned so whiff-punishing and spacing matter before any magic is involved.
2. **Risk/reward parry**: parry window is short (≈160ms) with a punishing recovery on failure (≈500ms vulnerable), but rewards a guaranteed Counter-Attack (1.5× damage) on success.
3. **Magic as punctuation, not a crutch**: elemental specials cost meaningful mana (25–40 of 100) and have longer startup than normals, positioning them as combo-extenders/finishers and zoning tools rather than primary damage.
4. **Air game**: double jump + air attack creates a vertical axis to escape okizeme (wake-up pressure) and open combos, but air attacks have no block option for the airborne player, creating risk.

## 3.3 Progression & Rewards (single-player meta layer)

- **Arcade Ladder**: sequential AI gauntlet (5 fights, escalating difficulty: Easy→Medium→Hard→Hard→Nightmare boss) per character. Clearing unlocks a cosmetic palette swap and a profile trophy.
- **Sword Unlocks**: 2 swords are available by default per character-agnostic pool (Steel Vanguard, neutral starter), the remaining 6 unlock via: Arcade clears (3), cumulative win count milestones (2), and a Survival Mode score threshold (1).
- **Achievements**: tracked event counters (e.g., "Land 50 Parries", "Win a match without blocking", "KO with an Ultimate") drive unlock flags and profile badges; persisted via the Save System (Section 15).
- **No pay-to-win or stat-gated grind**: all unlocks are *available* movesets/cosmetics, not power increases, preserving competitive integrity for local multiplayer and future online play.

## 3.4 Difficulty & Player Experience

- **Skill floor**: a new player can move, attack, and block within the first 10 seconds via a contextual control hint overlay (first-match only, dismissible).
- **Skill ceiling**: combo-routing, parry timing, meter management, and sword-specific tech (e.g., canceling recovery frames into Block) create a long mastery curve for competitive players.
- **AI as a teaching tool**: Easy AI deliberately whiffs punishes and telegraphs heavily so players learn spacing; Nightmare AI plays near-optimally (frame-perfect punishes, adaptive blocking) as an aspirational benchmark.
- **Session length**: a single round averages 30–60s, a full match (Bo3) 2–4 minutes — designed for quick "one more match" loops.


---

# 4. Technical Architecture

## 4.1 High-Level System Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                              GAME CLIENT                               │
│                                                                          │
│  ┌────────────┐   ┌──────────────┐   ┌───────────────┐                │
│  │  Input      │   │  Game Loop   │   │  Scene Manager │                │
│  │  Manager    │──▶│  (Vite app   │──▶│  (Menu/Battle/ │                │
│  │ (KB/GP)     │   │  entry, RAF) │   │   Results)     │                │
│  └────────────┘   └───────┬──────┘   └────────┬───────┘                │
│                            │                    │                       │
│                ┌───────────▼────────────────────▼───────────┐          │
│                │              ECS WORLD (per match)          │          │
│                │  Entities + Components + Systems pipeline   │          │
│                └───────────┬────────────────────┬───────────┘          │
│                            │                    │                       │
│        ┌───────────────────┘                    └──────────────┐       │
│        ▼                                                        ▼       │
│ ┌─────────────────┐                                   ┌──────────────┐  │
│ │  PHYSICS LAYER   │                                   │  RENDER LAYER │  │
│ │  Matter.js bodies│◀───sync position/rotation────────▶│  PixiJS       │  │
│ │  (ragdoll, AABB  │                                   │  Sprites,     │  │
│ │  broad-phase)    │                                   │  Containers,  │  │
│ └─────────────────┘                                   │  Particles    │  │
│                                                         └──────────────┘  │
│                                                                          │
│  ┌────────────┐   ┌──────────────┐   ┌───────────────┐  ┌────────────┐ │
│  │ Combat Core │   │  AI Module   │   │  Audio Engine  │  │ Save Mgr   │ │
│  │ (pure fns)  │   │ (FSM + BT)   │   │ (Howler-style) │  │(localStor) │ │
│  └────────────┘   └──────────────┘   └───────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## 4.2 Rendering Architecture (PixiJS)

- **Single shared `PIXI.Application`** created once at boot, with `resizeTo: window` and a fixed internal resolution (384×216 or 480×270 logical px, integer-scaled to the viewport) to preserve crisp pixel-art (`scaleMode: NEAREST`, `roundPixels: true`).
- **Layered Container hierarchy** per battle scene, back-to-front:
  ```
  stage
   └─ arenaLayer        (parallax background containers, 3–5 depths)
       └─ weatherLayer  (rain/snow/ash ParticleContainers, behind gameplay)
       └─ gameplayLayer
           └─ shadowLayer (blob shadows, drawn first)
           └─ entityLayer (player/enemy sprites, sorted by zIndex/y)
           └─ vfxLayer    (hit sparks, slashes, magic effects)
       └─ foregroundLayer (arena foreground occluders)
   └─ uiLayer            (HUD: health/mana/ultimate bars, combo counter, timer)
   └─ overlayLayer       (pause menu, round transition, results)
  ```
- **AnimatedSprite-based character rendering** driven by a texture-atlas (TexturePacker JSON, one atlas per character per sword-skin-state to cap draw calls). Each character entity owns one `AnimatedSprite` whose `textures` array is swapped per Animation System tick rather than re-instantiating sprites.
- **ParticleContainer** (not full Container) used for weather and high-count VFX (sparks, embers) since it disables per-child transforms/tinting we don't need at scale, maximizing batching.
- **Render loop separation**: Pixi's ticker drives rendering at display refresh rate; the ECS simulation steps on a fixed-timestep accumulator (see 4.7) so physics/combat are deterministic regardless of frame rate, with render interpolation between the last two simulation states to avoid visual stutter.

## 4.3 Physics Architecture (Matter.js, scoped usage)

Matter.js is **not** used for primary character locomotion (platformers need precise, non-springy control that general rigid-body solvers fight against). It is scoped to:

1. **Broad-phase collision detection** for hitbox/hurtbox overlap queries (using Matter's `Bodies`/`Query` as a fast spatial index — sensor bodies, no physics resolution applied to them).
2. **Knockback & hitstun trajectories**: on a confirmed hit, the victim's controller temporarily hands velocity control to a lightweight kinematic body that follows a designer-tunable arc (knockback vector + gravity), then hands control back to the platformer controller on landing/recovery.
3. **Ragdoll death**: on KO, the character's AnimatedSprite is swapped for a 5–7 segment Matter.js compound body (head, torso, upper/lower arm pairs, upper/lower leg pairs) connected by constraints, given an impulse from the killing blow, and simulated until it settles or 2.5s elapses (then frozen for the Results screen).
4. **Arena collision geometry**: static Matter bodies for ground, platforms, and walls, queried by the Movement System for grounded/ceiling/wall checks (custom AABB+slope raycasts, not Matter's solver, for the actual movement response).

```
PLATFORMER MOVEMENT (custom, deterministic)        RAGDOLL / KNOCKBACK (Matter.js)
┌─────────────────────────────┐                   ┌─────────────────────────────┐
│ Input → desired velocity     │                   │ KO event → spawn compound    │
│ Raycast vs static geometry   │   hand-off on KO   │ body, apply impulse from     │
│ Resolve position (AABB)      │ ───────────────►   │ killing-blow vector          │
│ Apply custom gravity/jump    │                   │ Matter solver simulates      │
└─────────────────────────────┘                   │ until settle → freeze frame  │
                                                     └─────────────────────────────┘
```

## 4.4 Animation Architecture

- **Data-driven animation definitions** per character+sword combination, stored as JSON: `{ name, frames: [...], frameDuration, loop, hitboxes: [{frame, shape, offset, size}], cancelWindows: [{frameStart, frameEnd, allowed: ['block','dash']}] }`.
- **Animation State Machine (per entity)**: Idle → Walk/Run → Jump/Fall → Attack(n) → Hitstun → Block/Parry → Death, with transition guards consuming Input/Combat component flags. Mirrors the Combat FSM described in 10.1 but governs *visual* state, decoupled so combat logic never blocks on art completion (animation is a *consequence* of combat state, never a gate for it, except where explicit cancel windows are defined).
- **Frame-accurate hit windows**: each attack animation embeds its own active-hitbox frames so designers tune hit timing by editing data, not code.

## 4.5 Combat Architecture

Pure, framework-agnostic `combat-core` module (see Section 10) consumed by the ECS Combat System. Inputs: attacker stats/sword/state, defender stats/sword/state, attack definition. Outputs: a `ResolutionResult` (damage, knockback vector, hitstun frames, meter deltas, status effects). This module has zero PixiJS/Matter.js imports, making it unit-testable in isolation and portable to a future Node.js authoritative server for multiplayer (Section 17).

## 4.6 AI Architecture

Two-tier design: a **Behavior Tree** for high-level decision making (Approach / Zone / Pressure / Retreat / Punish) and a **Finite State Machine** for low-level execution of the chosen behavior (mirrors the player's own input → action pipeline, so AI consumes the *same* Combat/Movement systems as a human player — no special-cased "AI cheats" path). Difficulty tiers tune BT node weights, reaction-time delay, and execution accuracy (Section 13).

## 4.7 Game Loop & Determinism

```
requestAnimationFrame(now)
  accumulator += (now - last)
  while (accumulator >= FIXED_DT (16.67ms / 60Hz)):
      previousState = currentState (shallow snapshot of transforms)
      stepSimulation(FIXED_DT)   // Input→AI→Physics→Combat→Animation(logic)→Save-tick
      accumulator -= FIXED_DT
  renderAlpha = accumulator / FIXED_DT
  render(interpolate(previousState, currentState, renderAlpha))  // PixiJS draw
```
Fixed-timestep simulation is the cornerstone of both competitive-integrity (consistent frame data regardless of device refresh rate) and future netcode (deterministic lockstep requires fixed, reproducible steps).

## 4.8 Save Architecture

See Section 15 for schema. Implementation: a `SaveManager` singleton wraps `window.localStorage`, serializing a single versioned JSON blob (`pixelSwordFighter:save:v1`), with migration functions keyed by schema version, debounced writes (max 1/sec), and a `try/catch` + in-memory fallback if localStorage is unavailable (private browsing).

## 4.9 Audio Architecture

- **WebAudio-backed engine** (thin wrapper, conceptually Howler-equivalent) with three buses: `music`, `sfx`, `ui`, each independently volume-controlled and persisted in settings.
- **Spatial SFX**: 2D stereo-pan + volume falloff computed from the sound-emitting entity's world-x relative to a virtual "camera center", applied to impact, footstep, and magic-cast sounds; music and UI sounds are never spatialized.
- **Pooled `AudioBufferSourceNode` reuse** for high-frequency SFX (hits, footsteps) to avoid GC churn; music streams via a single looping source per track with crossfade on arena/menu transitions.


---

# 5. Entity Component System Design

## 5.1 Philosophy

Entities are plain numeric/string IDs. Components are pure data (no methods). Systems are stateless functions that query the world for entities with a given component signature and mutate those components each fixed tick. This keeps gameplay logic data-oriented, testable, and easy to extend (new sword abilities = new component data + a small system branch, not new classes).

## 5.2 Entity Types

| Entity Archetype | Composition Summary |
|---|---|
| `PlayerFighter` | Transform, Velocity, PhysicsBody, Health, Stamina, Mana, UltimateMeter, InputController, AnimationState, Hurtbox, ComboState, SwordLoadout, StatusEffects, SpriteRef |
| `AIFighter` | Same as PlayerFighter, with `AIController` replacing `InputController` |
| `Hitbox` | Transform, OwnerRef, HitboxShape, DamagePacket, Lifetime |
| `Projectile` | Transform, Velocity, OwnerRef, DamagePacket, HitboxShape, Lifetime, VFXRef |
| `ParticleEmitter` | Transform, EmitterConfig, Lifetime |
| `ArenaProp` | Transform, PhysicsBody (static), RenderLayerRef |
| `RagdollSegment` | Transform, PhysicsBody (dynamic, Matter), ConstraintRefs, SpriteRef |

## 5.3 Component Catalog

| Component | Key Fields | Owned By |
|---|---|---|
| `Transform` | x, y, rotation, scale, facing (±1) | all visible/physical entities |
| `Velocity` | vx, vy | fighters, projectiles, ragdoll segments |
| `PhysicsBody` | matterBodyId, bodyType (kinematic/dynamic/static), collisionGroup | fighters (ground checks), arena props, ragdoll |
| `Health` | current, max, isInvulnerable, lastHitTimestamp | fighters |
| `Stamina` | current, max, regenRate, regenDelayTimer | fighters |
| `Mana` | current, max, regenRate | fighters |
| `UltimateMeter` | current (0-100), isReady | fighters |
| `InputController` | bufferedInputs[], heldKeys{} | PlayerFighter |
| `AIController` | difficulty, behaviorTreeState, reactionTimer, targetEntityId | AIFighter |
| `AnimationState` | currentClip, frameIndex, frameTimer, queuedClip | fighters, ragdoll |
| `Hurtbox` | shape, offset, size, vulnerableFlags | fighters |
| `HitboxShape` | shape, offset, size, activeFrameRange | Hitbox, Projectile |
| `DamagePacket` | baseDamage, damageType (physical/elemental), element, knockbackVector, hitstunFrames, canCrit, statusOnHit | Hitbox, Projectile |
| `ComboState` | chainIndex, comboTimer, lastMoveId, comboDamageScalar | fighters |
| `SwordLoadout` | swordId, statModifiers, elementId, specialMoveId, ultimateMoveId | fighters |
| `StatusEffects` | active[] (e.g., burning, frozen, shocked, hexed, staggered), each with remainingTime, tickRate | fighters |
| `SpriteRef` | pixiSpriteId / display object reference | all renderables |
| `OwnerRef` | entityId of the creator (for hit-attribution, friendly-fire rules) | Hitbox, Projectile |
| `Lifetime` | remainingFrames, onExpire (despawn/poolReturn) | Hitbox, Projectile, ParticleEmitter |
| `RenderLayerRef` | which Pixi container layer this entity's sprite belongs to | all renderables |

## 5.4 System Catalog & Execution Order (per fixed tick)

```
 1. InputCollectionSystem     — reads raw keyboard/gamepad, fills InputController.bufferedInputs
 2. AIDecisionSystem          — ticks BehaviorTree/FSM, writes equivalent "virtual inputs" into AIController
 3. ActionResolutionSystem    — converts buffered inputs into requested actions, respecting Stamina/Mana gates,
                                cooldowns, and current AnimationState cancel windows
 4. MovementSystem            — applies walk/run/jump/dash/roll velocity & gravity, raycasts vs static geometry
 5. PhysicsSyncSystem         — pushes kinematic transforms into Matter bodies; pulls ragdoll/knockback bodies out
 6. CombatSystem              — spawns/updates Hitbox entities per active AnimationState frame data
 7. HitDetectionSystem        — broad-phase (Matter spatial query) + narrow-phase overlap of Hitbox vs Hurtbox
 8. DamageResolutionSystem    — calls combat-core resolve(), applies Health/Stamina/Mana/Meter/Status mutations
 9. StatusEffectSystem        — ticks burning/frozen/shocked/hexed DOTs and movement modifiers
10. ComboTrackingSystem       — updates ComboState, resets on whiff/timeout
11. UltimateMeterSystem       — applies meter gains from step 8's events
12. AnimationStateSystem      — advances frame timers, resolves clip transitions from combat/movement state
13. ParticleSystem            — spawns/updates VFX emitters tied to animation/combat events
14. AudioEventSystem          — plays SFX queued by combat/movement/UI events this tick
15. SaveTickSystem            — increments achievement counters from this tick's events (no I/O; flushed async)
16. UISystem                  — reads Health/Mana/UltimateMeter/ComboState into HUD display components
17. RenderSyncSystem          — writes interpolated Transform → PixiJS sprite x/y/rotation/texture (render-loop side)
```

## 5.5 Key Relationships

- `SwordLoadout` is the single source of truth a system consults to branch behavior (e.g., `CombatSystem` looks up `specialMoveId` from `SwordLoadout` rather than character type, so any character can theoretically wield any sword — required for the "sword defines the kit" design pillar).
- `DamagePacket.element` drives `StatusEffectSystem` (Fire→burning DOT, Ice→frozen/slow, Lightning→shocked/stun-chance, Shadow→hexed/defense-down, Dragon→armor-break/bonus-vs-shield).
- `OwnerRef` on every Hitbox/Projectile prevents self-damage and attributes Ultimate-meter gain and Save-stat counters to the correct fighter.


---

# 6. Complete Folder Structure

```
pixel-sword-fighter/
├── public/
│   └── assets/                      # Static assets served as-is by Vite
│       ├── characters/              # Per-character texture atlases + JSON
│       │   ├── knight/
│       │   ├── samurai/
│       │   ├── assassin/
│       │   └── mage-warrior/
│       ├── swords/                  # Sword sprites + VFX atlases
│       ├── arenas/                  # Background layers, weather sprite sheets
│       ├── ui/                      # Icons, bar frames, buttons, fonts
│       └── audio/
│           ├── music/
│           └── sfx/
├── src/
│   ├── main.js                      # Vite entry point: boot Pixi app, mount SceneManager
│   ├── core/
│   │   ├── GameLoop.js              # Fixed-timestep accumulator (4.7)
│   │   ├── SceneManager.js          # Menu/Battle/Results scene stack
│   │   └── EventBus.js              # Decoupled pub/sub for cross-system events (KO, ParrySuccess, etc.)
│   ├── ecs/
│   │   ├── World.js                 # Entity registry, component storage, query helpers
│   │   ├── Entity.js
│   │   └── componentTypes.js        # Enum/registry of all component keys (5.3)
│   ├── components/                  # One file per component definition (data shape + factory)
│   │   ├── Transform.js
│   │   ├── Health.js
│   │   ├── Stamina.js
│   │   ├── Mana.js
│   │   ├── ComboState.js
│   │   ├── SwordLoadout.js
│   │   ├── StatusEffects.js
│   │   └── ... (5.3 full list)
│   ├── systems/                     # One file per system, in execution-order subfolders
│   │   ├── 01-input/InputCollectionSystem.js
│   │   ├── 02-ai/AIDecisionSystem.js
│   │   ├── 03-action/ActionResolutionSystem.js
│   │   ├── 04-movement/MovementSystem.js
│   │   ├── 05-physics/PhysicsSyncSystem.js
│   │   ├── 06-combat/CombatSystem.js
│   │   ├── 07-hitdetect/HitDetectionSystem.js
│   │   ├── 08-damage/DamageResolutionSystem.js
│   │   ├── 09-status/StatusEffectSystem.js
│   │   ├── 10-combo/ComboTrackingSystem.js
│   │   ├── 11-meter/UltimateMeterSystem.js
│   │   ├── 12-animation/AnimationStateSystem.js
│   │   ├── 13-particles/ParticleSystem.js
│   │   ├── 14-audio/AudioEventSystem.js
│   │   ├── 15-save/SaveTickSystem.js
│   │   ├── 16-ui/UISystem.js
│   │   └── 17-render/RenderSyncSystem.js
│   ├── combat-core/                 # Pure, framework-agnostic combat math (portable to server)
│   │   ├── damageFormula.js
│   │   ├── knockbackFormula.js
│   │   ├── parryWindow.js
│   │   ├── comboScaling.js
│   │   └── ultimateResolution.js
│   ├── data/                        # Designer-editable JSON/JS data, no logic
│   │   ├── characters/<id>.json     # base stats, animation clip manifest refs
│   │   ├── swords/<id>.json         # stat modifiers, special/ultimate definitions
│   │   ├── arenas/<id>.json         # layer manifest, weather config, collision geometry refs
│   │   ├── animations/<charId>-<swordId>/<clip>.json  # frame data + embedded hitboxes
│   │   └── balance/globalTuning.json # stamina/mana costs, regen rates, hitstun tables
│   ├── physics/
│   │   ├── MatterWorld.js           # Matter.js engine/world bootstrap, collision categories
│   │   ├── platformerMovement.js    # custom raycast-based movement resolver (not Matter solver)
│   │   └── ragdoll.js               # compound body + constraint builder for death physics
│   ├── ai/
│   │   ├── BehaviorTree.js          # generic BT runner
│   │   ├── nodes/                   # Approach, Zone, Pressure, Retreat, Punish, Block, etc.
│   │   └── difficultyProfiles.js    # Easy/Medium/Hard/Nightmare tuning tables
│   ├── rendering/
│   │   ├── PixiApp.js               # Application bootstrap, resolution/scale config
│   │   ├── layers.js                # Container hierarchy factory (4.2)
│   │   ├── SpriteFactory.js         # AnimatedSprite creation from atlas + clip data
│   │   └── particles/               # ParticleContainer configs (sparks, embers, snow, ash)
│   ├── audio/
│   │   ├── AudioEngine.js           # WebAudio bus management, spatialization
│   │   └── soundManifest.js
│   ├── ui/
│   │   ├── screens/                 # MainMenu, CharacterSelect, SwordSelect, ArenaSelect, Results
│   │   ├── hud/                     # HealthBar, ManaBar, UltimateMeter, ComboCounter, Timer
│   │   └── components/              # Reusable buttons, panels, tooltips
│   ├── save/
│   │   ├── SaveManager.js
│   │   ├── schema.js                # versioned save schema + migrations (Section 15)
│   │   └── achievements.js
│   ├── input/
│   │   └── InputBindings.js         # keyboard/gamepad mapping, rebind support
│   └── utils/
│       ├── objectPool.js            # generic pooling for Hitboxes/Particles/Projectiles
│       ├── math.js
│       └── assetLoader.js           # Pixi Assets bundle manifest + preloading
├── tests/
│   ├── unit/combat-core/            # damageFormula, knockback, parry, combo scaling tests
│   ├── unit/ai/                     # behavior tree node tests
│   ├── unit/save/                   # schema migration tests
│   └── integration/                 # full-tick simulation smoke tests (headless, no Pixi)
├── vite.config.js
├── package.json
└── README.md
```

**Folder responsibilities at a glance:** `data/` holds everything a designer can tune without touching code (character/sword/arena stats, animation frame timing, balance constants). `combat-core/` and `ai/` contain pure logic with zero rendering dependencies, the layer most likely to be reused server-side for multiplayer. `systems/` is intentionally numbered by execution order so the tick pipeline is self-documenting from the folder tree alone. `physics/` isolates all Matter.js usage so it never leaks into gameplay code outside the explicit sync points.


---

# 7. Asset Requirements

## 7.1 Naming Convention (global)

`<category>_<id>_<variant>_<state>_<frameIndex>.png`
Example: `char_knight_default_attackHeavy_03.png`, `sword_emberfall_idle_glow_07.png`, `arena_volcano_bgLayer2_loop_12.png`

Atlases are packed per `<category>_<id>_<variant>` group into a single TexturePacker sheet (`.png` + `.json`) to minimize draw calls.

## 7.2 Character Sprite Requirements

Base canvas: **64×64 px per frame** (character occupies roughly 40×56 px within the canvas for consistent anchor/pivot across animations). 4 characters × 1 base skin each at launch (palette-swap variants reuse frames with a shader/tint, no new art needed).

| Animation State | Frame Count (per character) | Loop? | Notes |
|---|---|---|---|
| Idle | 6 | Yes | Subtle breathing/sway |
| Walk | 8 | Yes | |
| Run | 8 | Yes | |
| Jump (rise) | 4 | No | |
| Fall | 3 | Yes | |
| Land | 3 | No | |
| Double Jump | 5 | No | distinct flourish per character |
| Dash | 5 | No | motion-blur smear frames |
| Roll | 8 | No | includes i-frame window |
| Block (hold) | 3 | Yes | |
| Block (impact) | 2 | No | |
| Parry (success) | 4 | No | |
| Light Attack (×3 combo stages) | 5 each (15 total) | No | |
| Heavy Attack | 8 | No | longer windup |
| Combo Finisher | 10 | No | unique per character |
| Air Attack | 6 | No | |
| Dash Attack | 6 | No | |
| Counter-Attack | 7 | No | |
| Magic Cast (per element the character's *default* sword uses) | 9 | No | base set; additional sword-specific casts reuse skeleton via 7.4 |
| Ultimate Cast | 14 | No | high-budget hero animation |
| Hitstun (light/heavy) | 2 / 4 | No | |
| Death → Ragdoll transition | 3 | No | hands off to physics-driven ragdoll, no further sprite frames needed |

**Per-character total: ≈ 130 unique frames** (idle through ultimate, excluding palette swaps) × 4 characters = **≈520 base frames** for launch roster.

## 7.3 Sword Asset Requirements

Each of the 8 swords needs:
- **Held sprite overlay**: not separate frames per character animation; instead a **socket-based attachment** — a single 32×32 sword sprite (idle + 4-frame "glow/idle shimmer" loop for magic swords) parented to a hand bone/anchor point defined per character animation frame (data in `data/animations/.../<clip>.json` as `swordAnchor: {x,y,rotation}` per frame). This avoids redrawing every character animation per sword (32 combinations) and is the key art-budget saving in the spec.
- **Special-move VFX sheet**: 12–16 frames, 96×96 or 128×128 canvas, per element (Fire/Ice/Lightning/Shadow/Dragon) — shared across swords of the same element, with a tint/shape variant for the sword-specific flourish (≈4–6 unique frames on top of the shared base).
- **Ultimate VFX sheet**: 20–28 frames, up to full-screen-relevant canvas (e.g., 256×144) — fully unique per sword (8 unique ultimate VFX sheets).
- **Inventory/menu icon**: 1 frame, 96×96, for Sword Select screen.

**Per-sword total: ≈ 1 held sprite (5 frames) + ~6 special VFX frames (unique) + ~24 ultimate VFX frames + 1 icon ≈ 36 unique assets** × 8 swords = **≈288 sword-related frames**, plus 5 shared elemental base VFX sheets (~14 frames each = 70 shared frames).

## 7.4 Arena Asset Requirements

Per arena (5 total: Forest Temple, Frozen Mountain, Volcano, Dark Castle, Sky Kingdom):

| Layer | Resolution | Frames | Notes |
|---|---|---|---|
| Sky/far background | 480×270 (matches logical canvas) | 1 static + optional 6-frame cloud/cycle loop | parallax factor ~0.1 |
| Mid background (architecture/terrain silhouette) | 480×270 | 1 static | parallax factor ~0.4 |
| Near background / set dressing | 480×270 | 4–8 frame ambient loop (torches, mist, lava glow) | parallax factor ~0.7 |
| Foreground occluders (pillars, branches) | varies, transparent PNG | 1 static (or 4-frame sway for foliage) | parallax factor ~1.2 |
| Platform/ground tileset | 16×16 tiles | ~24 tiles | collision geometry authored alongside in Tiled-style JSON |
| Weather particle sprite | 8×8–16×16 | 4–6 frame loop | rain/snow/ash/embers/wind-leaves, one set per arena theme |

**Per-arena total: ≈ 60–80 unique frames + 24 tiles.** × 5 arenas = **≈400 frames + 120 tiles**.

## 7.5 UI Asset Requirements

| Asset | Resolution | Quantity | Notes |
|---|---|---|---|
| Health bar frame + fill | 200×20 (frame), fill is a stretched/masked sprite | 1 set (2 pieces) | color-shifts at low HP via tint, no extra frames |
| Mana bar frame + fill | 160×12 | 1 set | |
| Ultimate meter frame + fill + "ready" glow state | 160×16 | 1 set + 4-frame glow loop when full | |
| Combo counter digits | 16×20 per glyph | 1 numeral set (0–9 + "x") | |
| Round timer digits | shared numeral set | reuse above | |
| Character select portraits | 96×96 | 4 (one per character) | |
| Sword select icons | 96×96 | 8 (reuse from 7.3) | |
| Arena select thumbnails | 160×90 | 5 | |
| Buttons (primary/secondary/disabled states) | 120×32 | 3 states × ~6 button types | |
| Cursor/selector highlight | 24×24 | 1 (4-frame pulse loop) | |
| Generic icon set (block, parry, element icons ×5, settings, pause) | 24×24 | ~12 icons | |

## 7.6 Audio Asset Requirements

| Type | Quantity | Notes |
|---|---|---|
| Music tracks | 8 total: 1 main menu, 1 char/sword/arena select (can share), 5 arena battle themes, 1 results/victory jingle | Looping stems, ~90–120s each |
| Core SFX | ~40: footstep(x2 surfaces), jump, land, dash, roll, light/heavy/combo swing(x3), block impact, parry success/fail, counter-attack, KO, UI click/hover/confirm/back | Short, <1s |
| Elemental SFX | 5 elements × 3 each (cast, impact, status-tick) = 15 | |
| Ultimate SFX | 8 (one per sword), 2–3s stinger | |
| Ambient arena loops | 5 (one per arena: wind, lava bubbling, wind-chimes, dripping water, cathedral echo) | layered under music at low volume |


---

# 8. Character Design Specification

Base stats use a common scale: HP (pool), Stamina (pool), Mana (pool), Move Speed (px/frame at 60Hz baseline), Strength (physical damage multiplier, 1.00 = baseline), Defense (flat % damage reduction), Crit Chance (%), Weight (knockback resistance multiplier, 1.00 = baseline).

## 8.1 Male Knight

| Stat | Value |
|---|---|
| HP | 120 (highest) |
| Stamina | 100 |
| Mana | 80 (lowest) |
| Move Speed | 2.6 (slowest) |
| Strength | 1.10 |
| Defense | 12% |
| Crit Chance | 5% |
| Weight | 1.20 (hardest to knock back) |

- **Default sword**: Steel Vanguard (neutral).
- **Skills**: Shield-Bash Heavy (heavy attack with brief armor/super-armor on startup, resists flinch from light attacks), Fortify (passive: -10% knockback taken while grounded).
- **Animations**: heaviest/slowest wind-ups, largest hit-stop on connect, ground-stomping run cycle, deliberate roll (shortest distance, longest i-frames).
- **Strengths**: highest effective HP pool combined with Defense% makes him the best at absorbing mistakes; super-armor on Heavy lets him trade through enemy lights.
- **Weaknesses**: lowest mobility makes him vulnerable to zoning/keep-away strategies and air-game opponents (Assassin); lowest Mana limits magic-special frequency.

## 8.2 Male Samurai

| Stat | Value |
|---|---|
| HP | 95 |
| Stamina | 110 (highest) |
| Mana | 95 |
| Move Speed | 3.4 |
| Strength | 1.05 |
| Defense | 6% |
| Crit Chance | 12% (highest) |
| Weight | 0.95 |

- **Default sword**: Stormrend Katana (lightning).
- **Skills**: Iaijutsu Counter (a dedicated, faster counter-attack window than the universal kit — see 10.7 — with bonus crit chance on success), Bushido Flow (passive: combo timer is 15% longer, encouraging extended chains).
- **Animations**: fast, precise single-frame "snap" strikes, minimal recovery on lights, signature single-cut Ultimate (one devastating draw-cut rather than a flurry).
- **Strengths**: best counter-attack and combo-chain character; high stamina supports aggressive dash/roll movement uptime.
- **Weaknesses**: lowest Defense% makes him fragile if his counter/parry timing fails; below-average HP punishes greedy combo extensions that get interrupted.

## 8.3 Female Assassin

| Stat | Value |
|---|---|
| HP | 80 (lowest) |
| Stamina | 100 |
| Mana | 100 |
| Move Speed | 4.0 (highest) |
| Strength | 0.95 |
| Defense | 4% (lowest) |
| Crit Chance | 18% (highest) |
| Weight | 0.75 (lightest, most knockback taken) |

- **Default sword**: Nightshade Fang (shadow).
- **Skills**: Shadow Step (a unique extra movement option layered onto Dash — short teleport-dash with 4 extra i-frames vs. the universal Roll), Glass Cannon (passive: +20% damage dealt while below 50% HP, raising risk/reward at low health).
- **Animations**: fastest frame-data across the whole kit, double-jump has the highest apex and air-control, attacks read as quick slashes with minimal windup but minimal range.
- **Strengths**: best mobility and crit output enables hit-and-run patterns and the best air-game/escape options of the roster.
- **Weaknesses**: lowest HP+Defense+Weight combination means she dies fastest to a clean read; short attack range loses pure footsies vs. Samurai/Knight at mid-range.

## 8.4 Female Mage Warrior

| Stat | Value |
|---|---|
| HP | 90 |
| Stamina | 85 (lowest) |
| Mana | 130 (highest) |
| Move Speed | 2.9 |
| Strength | 1.00 |
| Defense | 8% |
| Crit Chance | 8% |
| Weight | 1.00 |

- **Default sword**: Dragonscale Greatsword (dragon).
- **Skills**: Arcane Reservoir (passive: Mana regen rate +30%, and magic-special mana cost -15%), Elemental Echo (her magic-special, when it lands, applies its status effect at 150% duration vs. the universal rate).
- **Animations**: every magic cast has an extended, ornate windup (longest in the roster) compensated by the largest hitbox/area-of-effect on specials; melee normals are average-speed/average-range.
- **Strengths**: best sustained magic-pressure character — can weave specials far more often than anyone else due to Mana pool + regen + cost discount; status-effect uptime (via Elemental Echo) is unmatched.
- **Weaknesses**: lowest Stamina limits Roll/Dash/Heavy spam, and long magic windups are highly punishable if read — she is the most vulnerable to aggressive rushdown that denies her cast time.


---

# 9. Sword Design Specification

Damage is expressed as a multiplier applied to the wielder's Strength-scaled base attack values; Speed is a multiplier on animation playback/recovery (1.00 = baseline, higher = faster recovery). All swords also carry the universal moveset (Light/Heavy/Combo/Air/Dash/Block/Parry/Counter) — only the Damage/Crit/Speed modifiers and the unique Special/Ultimate differ per sword.

| # | Sword | Element | Damage Mult. | Crit Chance Mod. | Speed Mult. | Special Ability | Ultimate Attack |
|---|---|---|---|---|---|---|---|
| 1 | **Steel Vanguard** | Neutral | 1.00 | +0% | 1.00 | *Guard Surge*: brief (0.5s) full block on demand outside the normal Block stance, on a 6s cooldown | *Vanguard's Judgment*: single armored overhead strike, unblockable, +50% dmg if target is below 30% HP |
| 2 | **Emberfall Cleaver** | Fire | 1.15 | +3% | 0.90 | *Cinder Slash*: arcing fire wave, applies Burning (DOT, 3 ticks over 3s) | *Inferno Reckoning*: ground eruption in a radius around the wielder, multi-hit, leaves the floor burning for 4s |
| 3 | **Frostbite Edge** | Ice | 0.95 | +0% | 1.00 | *Glacial Thrust*: forward ice-spike poke, applies Frozen (50% move-speed slow, 2.5s) | *Absolute Zero*: freezes opponent in place (full stun, 1.2s) then a guaranteed follow-up heavy strike |
| 4 | **Stormrend Katana** | Lightning | 1.05 | +5% | 1.15 | *Volt Slash*: instant dash-strike with brief lingering shock field, applies Shocked (15% chance to interrupt opponent's next action) | *Thunder Cascade*: 5-hit lightning-fast flurry ending in a launcher, full-screen lightning bolt VFX |
| 5 | **Nightshade Fang** | Shadow | 1.10 | +8% | 1.10 | *Umbral Pierce*: short-range teleport-strike through the opponent (repositions wielder behind them), applies Hexed (-15% Defense, 3s) | *Eclipse*: screen darkens, wielder becomes briefly untargetable then delivers a guaranteed crit from a random flank |
| 6 | **Dragonscale Greatsword** | Dragon | 1.25 (highest) | +0% | 0.80 (slowest) | *Dragon's Breath*: large cone fire-and-force AoE, applies Armor Break (-20% Defense, ignores block chip-reduction for 3s) | *Wyrm's Descent*: summons a spectral dragon head that bites a large frontal area for massive multi-hit damage |
| 7 | **Solaris Rapier** | Fire (hybrid, crit-focused) | 0.90 | +15% (highest) | 1.20 (fastest) | *Sunpiercer*: rapid triple-thrust, each hit individually crit-eligible, light Burning on final hit only | *Radiant Execution*: a flurry of precise thrusts culminating in a guaranteed-crit finisher if any hit in the flurry connects |
| 8 | **Voidcaller** | Shadow/Dragon hybrid (Legendary, unlock-gated) | 1.15 | +10% | 0.95 | *Void Rend*: pulls the opponent toward the wielder (short hard CC) and applies both Hexed and Armor Break simultaneously at reduced potency | *Abyssal Convergence*: full-screen void zone that periodically pulses damage and applies Hexed for its duration (highest total-damage ultimate in the game if the opponent cannot escape the zone) |

**Design notes:** Damage and Speed multipliers are inversely correlated by design (Dragonscale: highest damage/slowest; Solaris: lowest damage/fastest) to keep all 8 swords viable rather than strictly dominant. Voidcaller is intentionally the strongest *average* sword and is gated behind the hardest unlock (Survival Mode score threshold, Section 3.3 / Section 15) so its power is earned, not available to new players turn one. All Special abilities cost 30 Mana baseline (Mage Warrior's passive reduces this — Section 8.4); all Ultimates require a full 100 Ultimate Meter.


---

# 10. Combat System Design

## 10.1 Attack System & State Machine

```
                ┌────────┐
        ┌──────▶│  Idle  │◀─────────────────────────┐
        │       └───┬────┘                            │
        │           │ Light/Heavy/Combo/Dash/Air input │
        │           ▼                                  │
        │      ┌──────────┐   active hit frames    ┌───┴────┐
        │      │ Startup  │────────────────────────▶│ Active │
        │      └──────────┘                          └───┬────┘
        │                                                 │ hit landed / whiffed
        │                                            ┌────▼─────┐
        │           cancel window (sword/move-data)  │ Recovery │
        │      ◀─────────────────────────────────────┤          │
        │                                              └────┬────┘
        │                                                   │ timeout
        └───────────────────────────────────────────────────┘

   Interrupting branches available from any non-Active frame (per move's cancelWindows):
   Block, Parry, Roll(if i-frame-eligible), Dash
```

## 10.2 Combo System

- Light attacks chain Light→Light→Light into a 3-hit combo; inputting Heavy at chain step 2 or 3 branches into a Heavy-finisher; each successive hit applies a **damage scalar** (1.00, 0.85, 0.70, 0.55 floor) to prevent infinite-combo lockouts from trivializing matches (`comboScaling.js` in `combat-core/`).
- A **combo timer** (≈0.9s, refreshed on each landed hit) resets `ComboState.chainIndex` to 0 if the player doesn't continue; whiffing any chain step also resets immediately.
- Air Attacks and Dash Attacks can extend a combo (juggle continuation) but apply a steeper scalar (0.5 floor) and respect a **juggle limit** of 4 airborne hits before forced knockdown, preventing infinite juggles.

## 10.3 Hitboxes & Hurtboxes

- **Hurtbox**: one capsule/box per fighter, sized to the character's actual silhouette per animation frame (a handful of keyframe-defined sizes interpolated, not a single static box) — stored as `Hurtbox` component data referencing the active `AnimationState` frame.
- **Hitbox**: spawned as a short-lived `Hitbox` entity by `CombatSystem` only during a move's `activeFrameRange`; shape/offset/size authored per-frame in the move's animation JSON (Section 4.4), enabling moves like the Samurai's thrust to have a hitbox that grows then shrinks across its active frames.
- Hit detection runs broad-phase (Matter spatial query against a coarse AABB) then narrow-phase (precise shape-vs-shape test) each tick in `HitDetectionSystem`; a hit is only valid once per Hitbox lifetime per target (`hitTargets` set on the Hitbox entity prevents multi-hit from a single swing unless the move is explicitly authored as multi-hit, e.g., Thunder Cascade).

## 10.4 Damage Formula

```
finalDamage = baseMoveDamage
            × attackerStrength
            × swordDamageMultiplier
            × comboScalar
            × (isCrit ? critMultiplier : 1.0)
            × (1 − defenderDefensePercent)
            × elementalAffinityModifier      // e.g., Fire sword vs an "ice-resistant" buff, future-proofing
            + flatPenetration                // some moves ignore a fixed amount of Defense (e.g., Dragon's Armor Break interaction)

isCrit = roll(0,100) < (attackerBaseCrit + swordCritModifier + comboStageBonus)
```
All terms are pure inputs to `damageFormula.js` — no hidden global state — making the formula independently unit-testable against a fixture table of expected outputs per character/sword pairing.

## 10.5 Knockback Formula

```
knockbackMagnitude = baseKnockback(moveId)
                    × (1 + (finalDamage / defenderMaxHP))   // bigger hits relative to remaining HP knock further
                    ÷ defenderWeight
                    × (isCounterOrParryPunish ? 1.3 : 1.0)

knockbackVector = normalize(attackerFacing, moveLaunchAngle)  // most moves: mostly-horizontal; "launchers": steep vertical
hitstunFrames   = baseHitstun(moveId) × (1 + comboStageBonus) capped at HITSTUN_CAP (prevents true-infinite stunlocks)
```

## 10.6 Parry System

- **Parry input window**: 160ms (≈9–10 frames at 60Hz) from input press; if an incoming Hitbox overlaps the defender's Hurtbox during this window AND the defender issued Parry, the hit is voided, the attacker is placed in a **Parried** state (0.5s, vulnerable, no input accepted), and the defender gains a guaranteed **Counter-Attack** input window (0.4s) plus a flat Ultimate-meter bonus.
- **Failed parry** (input issued but no hit arrives within the window, or hit arrives outside it): defender enters a 0.3s recovery-locked state, punishable but not as severely as a whiffed Heavy attack — parry is designed to be *attempted* reasonably often, not an all-or-nothing gamble.

## 10.7 Counter-Attack System

A Counter-Attack is only available immediately following (a) a successful Parry, or (b) the Samurai's faster, sword-agnostic-but-character-specific Iaijutsu Counter window (Section 8.2). It deals 1.5× the wielder's current sword's Light Attack damage, cannot be blocked (the opponent is in a forced-Parried/stagger state), and refreshes the defender's combo-chain to step 1 if they continue attacking afterward.

## 10.8 Ultimate System

- Meter fills 0→100 from: damage dealt (0.6 meter per 1 damage dealt, roughly), damage taken (0.25 per 1 damage taken), successful parry (flat +12), successful counter-attack (flat +8).
- At 100, the HUD Ultimate Meter enters a "Ready" glow state and the Ultimate input becomes available; using it consumes the full meter regardless of partial overflow.
- Ultimates have **no traditional Hurtbox vulnerability during their unique cast animation only on Startup frames that are explicitly marked super-armored** (data-driven per sword, since some Ultimates like Thunder Cascade are fast/evasive while Wyrm's Descent is a deliberate stationary cast) — this is authored per-sword in `data/swords/<id>.json`, not hardcoded.

## 10.9 Combat Flow Diagram (Neutral → Punish loop)

```
[Neutral spacing] → Attacker commits to a move (Startup)
        │
        ├─ Defender Blocks ─────────────▶ Chip damage, attacker recovers, reset to Neutral
        ├─ Defender Parries (in window) ─▶ Attacker Parried-state → Defender Counter-Attack → big advantage
        ├─ Defender takes the hit ───────▶ Damage/Knockback/Hitstun applied → ComboTracking continues
        └─ Defender evades (Roll/jump) ──▶ Attacker recovers in Whiff state → Defender free Punish window
```

---

# 11. Physics System Design

## 11.1 Movement (custom, not Matter solver)

- Each fighter's `PhysicsBody` tracks grounded/airborne state via a short downward raycast against static arena geometry each tick.
- **Walk/Run**: target horizontal velocity set directly from input, with acceleration/deceleration curves (not instant) for readable footing; Run is Walk × a sword-independent character multiplier, gated by holding a modifier or a speed threshold from sustained input.
- **Jump**: instantaneous upward velocity impulse on press while grounded; **Double Jump** consumes a per-airborne-cycle charge, resets only on landing or wall-touch (no infinite air-stalling).
- **Gravity**: custom constant applied to `Velocity.vy` every tick when airborne, with a separate (higher) "fast-fall" gravity once descending past attack-cancel windows, for snappier landings.

## 11.2 Dash & Roll

- **Dash**: fixed-distance horizontal burst over ~5 frames, no i-frames, can be canceled into an attack (Dash Attack) — a movement *and* offense tool, costs Stamina.
- **Roll**: longer animation (~8 frames), grants i-frames for a sub-window of those frames (data-driven per character, e.g., Assassin's Shadow Step variant has more i-frames), cannot cancel into an attack — a pure defensive/repositioning tool, costs more Stamina than Dash.

## 11.3 Collision

- **Static geometry** (ground/platforms/walls) are Matter.js static bodies used only as the *queryable shape source* for the custom raycast resolver in 11.1 — Matter's own solver never resolves fighter-vs-ground collision directly, avoiding bounce/jitter artifacts common when general physics engines drive precise platformer movement.
- **Fighter-vs-fighter** bodies do not physically collide/push by default in neutral (avoids janky stacking); a deliberate "clash" pushback is applied only as an explicit Knockback event (10.5), not passive solid-body collision.

## 11.4 Knockback & Hitstun Hand-off

On a confirmed hit (10.5), the victim's `PhysicsBody` is temporarily switched to "knockback-kinematic" mode: velocity is set directly from `knockbackVector × knockbackMagnitude`, custom gravity still applies, and player/AI input is ignored for `hitstunFrames`. Control returns to normal `MovementSystem` handling once hitstun expires AND the fighter has either landed or hitstun naturally times out mid-air (entering a brief "tech/recovery" window where a Roll-cancel is allowed to mitigate combo extension — a core competitive-fairness mechanic).

## 11.5 Ragdoll Death

On `Health.current <= 0`: 
1. Despawn the `AnimatedSprite`; spawn a 7-segment Matter.js compound ragdoll (head, torso, 2× upper-arm, 2× upper-leg, with lower-limb constraints) at the fighter's last Transform.
2. Apply an impulse to the torso segment derived from the killing blow's `knockbackVector × magnitude × ragdollImpulseScalar`.
3. Let Matter's solver run freely (real rigid-body simulation, the one place per-match where Matter fully drives the outcome) for up to 2.5s or until all segment velocities fall under a "settled" threshold, then freeze the bodies for the Results screen freeze-frame.

---

# 12. Arena System Design

For all 5 arenas, the layer/weather/particle/perf structure follows the rendering model from 4.2; specifics below.

| Arena | Background Layers (back→front) | Weather/Atmosphere | Particle Effects | Performance Considerations |
|---|---|---|---|---|
| **Forest Temple** | Sky+canopy silhouette, ruined temple mid-ground, mossy foreground pillars | Light dappled-light shafts (static shader-free gobo sprites), occasional falling leaves | Floating pollen/firefly motes (low count, ParticleContainer) | Foliage sway uses a 4-frame loop, not per-leaf simulation, to cap entity count |
| **Frozen Mountain** | Distant peaks, mid snowfield with ice formations, foreground icicle overhangs | Persistent snowfall, wind-gust bursts that briefly increase snow density | Snow (ParticleContainer, ~150 particles), occasional ice-crystal sparkle bursts on impact | Snow particle count is the single highest-density VFX in the game; capped and pooled, recycled rather than re-instantiated |
| **Volcano** | Distant lava-glow sky, mid-ground cracked rock with lava rivers, foreground ember-lit rocks | Ambient ash fall, periodic background lava-bubble "burp" animation (non-interactive, looped) | Embers (ParticleContainer), heat-shimmer achieved via a cheap vertical-offset sine wave on background layer, not a real-time shader, for perf | Lava-glow uses an animated emissive sprite layer rather than dynamic lighting; avoids per-pixel shader cost |
| **Dark Castle** | Night sky w/ moon, gothic silhouette mid-ground, foreground broken stained-glass frame | Occasional lightning-flash full-screen tint pulse (timed, not player-triggered) | Drifting dust motes, cobweb-sway foreground accents (low count) | Flash effect is a single full-screen color overlay alpha pulse, not per-object relighting — cheapest possible "dramatic lighting" |
| **Sky Kingdom** | Cloud-sea horizon, floating-island mid-ground, foreground cloud wisps | Drifting cloud parallax at multiple speeds, occasional wind gust that shifts foreground wisps | Floating light motes / feather particles | Cloud layers reuse a small tile set scrolled at different rates rather than unique full-width art, minimizing texture memory |

**Cross-arena performance rule:** every arena's combined particle budget is capped at **200 active particles** rendered via `ParticleContainer` (not standard `Container`), and all background-layer animations are pre-baked sprite-sheet loops rather than runtime-simulated systems, keeping arena rendering cost effectively constant regardless of which arena is selected.


---

# 13. Enemy AI Design

## 13.1 Two-Tier Architecture

**Behavior Tree (strategic layer, re-evaluated every ~250–500ms or on key events like landing a hit/getting hit):**

```
                         ┌───────────────┐
                         │  Root Selector │
                         └───────┬───────┘
        ┌─────────────┬─────────┼─────────────┬──────────────┐
        ▼             ▼         ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐ ┌─────────┐ ┌───────────┐  ┌───────────┐
  │ Punish?   │  │ Low HP?  │ │ Spacing │ │ Zone?      │  │ Pressure?  │
  │ (opponent │  │ (retreat │ │ check   │ │ (opponent  │  │ (opponent  │
  │ whiffed/  │  │ + heal-  │ │         │ │ far, use   │  │ near +     │
  │ recovering│  │ via-     │ │         │ │ magic      │  │ advantage, │
  │ )         │  │ distance)│ │         │ │ special)   │  │ go in)     │
  └──────────┘  └──────────┘ └─────────┘ └───────────┘  └───────────┘
        (priority-ordered selector; first matching condition wins)
```

**Finite State Machine (execution layer, ticks every fixed-step like a player's input):**

```
   Approach ──▶ Footsies ──▶ CommitAttack ──▶ Recover ──▶ (loop)
       ▲                         │
       │                         ▼
   Retreat ◀──────────────── Defend(Block/Parry-attempt)
```

The FSM consumes the *same* `ActionResolutionSystem` entry points a human's `InputController` does — the AI cannot perform actions outside the Stamina/Mana/cooldown rules a player obeys, preserving fairness and making the AI a valid testbed for balance.

## 13.2 Difficulty Scaling Table

| Parameter | Easy | Medium | Hard | Nightmare |
|---|---|---|---|---|
| Reaction delay (ms, before responding to opponent's startup) | 350–450 | 200–280 | 90–150 | 16–50 (near frame-perfect) |
| Parry attempt accuracy | 10% (rarely even tries) | 40% | 70% | 92% |
| Block-on-read probability | 25% | 55% | 80% | 95% |
| Punish-window exploitation (whiff punish rate) | 15% | 45% | 75% | 95% |
| Combo execution drop chance (mis-input simulation) | 35% | 15% | 4% | 0% |
| Magic-special usage frequency | Low (mana often capped, underused) | Moderate | High, well-timed | Optimal, weaves on cooldown |
| Aggression bias (BT weight toward Pressure vs Zone/Retreat) | Low | Balanced | High | Adaptive (shifts based on live HP/meter state) |
| Movement-tech usage (Roll-cancel, Dash-cancel, juggle extension) | None | Basic Roll only | Roll + Dash-cancel | Full tech including juggle-limit-aware combos |

Nightmare AI is explicitly **not** given hidden stat buffs (no extra damage/HP) — its difficulty comes entirely from execution precision and decision quality, keeping it a legitimate skill benchmark rather than an artificial wall.

## 13.3 Adaptive Behavior (Hard/Nightmare only)

A lightweight rolling-window opponent-model tracks the human/AI opponent's last ~20 actions to bias the BT's Selector weights — e.g., if the opponent has parried successfully 3+ times recently, Nightmare AI reduces raw-attack frequency and increases feint/bait behavior (committing to Startup then canceling into Block where the move's data allows, if available) to bait premature parries.

---

# 14. UI System Design

## 14.1 Screen Inventory & Flow

```
MainMenu ─┬─▶ CharacterSelect ─▶ SwordSelect ─▶ ArenaSelect ─▶ Battle ─▶ Results ─┬─▶ Rematch (back to Battle)
          │                                                                       └─▶ MainMenu
          ├─▶ Settings (audio/controls/display)
          └─▶ Achievements/Unlocks viewer
```

## 14.2 Per-Screen Design

- **Main Menu**: Arcade, Versus (local 2P), Survival, Settings, Achievements. Animated background loop (reuses a held arena's far-layer art) for ambience without extra art cost.
- **Character Selection**: 4 portraits in a horizontal row, larger preview pane shows idle-loop AnimatedSprite of the hovered character with stat-bar previews (HP/Stamina/Mana/Speed as simple horizontal meters, not exact numbers, to stay readable at a glance).
- **Sword Selection**: grid of 8 icons, locked swords shown grayed-out with an unlock-condition tooltip on hover; selecting a sword live-updates a stat-delta preview ("+15% Damage, −10% Speed") relative to the character's base.
- **Arena Selection**: 5 thumbnails, each shows a short looping background preview on hover (lightweight: just the far-background layer, not full scene).
- **Battle Screen (HUD layout)**:
  ```
  ┌──────────────────────────────────────────────────────────┐
  │ [P1 Health bar + Mana + Ultimate]   00:90   [P2 mirrored]   │
  │                                                              │
  │                     (gameplay viewport)                     │
  │ [P1 Combo Counter, bottom-left]    [P2 Combo Counter, BR]   │
  └──────────────────────────────────────────────────────────┘
  ```
  Health bar depletes with a fast "true" segment and a slower trailing "ghost" segment (common fighting-game readability convention) so chip damage is visible even after the hit; Ultimate meter glows + pulses at 100%.
- **Results Screen**: winner's portrait + victory animation pose, round-by-round summary (W/L per round), "Rematch" / "Main Menu" buttons, plus any newly-unlocked achievement toast.

## 14.3 UI System Implementation Notes

`UISystem` (Section 5.4, step 16) is purely a **read** layer — it never mutates gameplay components, only projects `Health`/`Mana`/`UltimateMeter`/`ComboState` values into the corresponding Pixi UI display objects each tick, keeping UI fully decoupled from simulation correctness (a UI bug cannot desync gameplay state).

---

# 15. Save System Design

## 15.1 Save Schema (versioned JSON, stored under a single localStorage key)

```json
{
  "schemaVersion": 1,
  "profile": {
    "totalMatchesPlayed": 0,
    "totalWins": 0,
    "totalLosses": 0
  },
  "unlocks": {
    "swords": {
      "steelVanguard": true,
      "emberfallCleaver": false,
      "frostbiteEdge": false,
      "stormrendKatana": false,
      "nightshadeFang": false,
      "dragonscaleGreatsword": false,
      "solarisRapier": false,
      "voidcaller": false
    },
    "cosmetics": {}
  },
  "progression": {
    "arcadeClears": { "knight": 0, "samurai": 0, "assassin": 0, "mageWarrior": 0 },
    "survivalHighScore": 0
  },
  "achievements": {
    "parryLandedCount": 0,
    "ultimateLandedCount": 0,
    "noBlockWinCount": 0,
    "unlockedAchievementIds": []
  },
  "settings": {
    "musicVolume": 0.8,
    "sfxVolume": 1.0,
    "controlBindings": {}
  }
}
```

## 15.2 Unlock Conditions (drives 3.3)

| Sword | Unlock Condition |
|---|---|
| Emberfall Cleaver | Clear Arcade with any character |
| Frostbite Edge | Clear Arcade with any character (2nd character cleared) |
| Stormrend Katana | Clear Arcade with any character (3rd character cleared) |
| Nightshade Fang | Reach 25 total wins |
| Solaris Rapier | Reach 50 total wins |
| Dragonscale Greatsword | Clear Arcade with all 4 characters |
| Voidcaller | Reach a Survival Mode score of 15 consecutive wins |

## 15.3 Save Architecture Implementation

- `SaveManager.load()` reads the JSON blob, runs it through `schema.migrate(data, fromVersion, toVersion)` if `schemaVersion` is behind current, and falls back to a fresh default object (never throwing) if parsing fails or the key is absent.
- `SaveManager.save()` is debounced (max once per second) and called from `SaveTickSystem` only when a tracked counter actually changes that tick, minimizing localStorage writes.
- All achievement/unlock checks are **pure functions** of the save data (`checkUnlocks(saveData) → newlyUnlockedIds[]`), called after every save-mutating event, so unlock logic is unit-testable without touching localStorage directly (tests inject a mock save object).


---

# 16. Performance Strategy (Target: 60 FPS on mid-range hardware)

## 16.1 Texture Atlas Strategy

- Every character, sword, arena layer set, and UI element group is packed into a TexturePacker atlas (power-of-two dimensions, max 2048×2048 per sheet) to keep total draw calls in the low double digits per frame regardless of scene complexity.
- Atlases are split by *usage frequency*, not just by content category: always-loaded UI/common-VFX atlas stays resident across all scenes, while per-arena and per-character atlases are loaded/unloaded by `assetLoader.js` only for the active Character-Select/Battle scene, capped via PixiJS `Assets` bundles.
- Sword "held sprite" assets (Section 7.3) are deliberately kept in their own small shared atlas since up to 2 swords (P1+P2) must be resident simultaneously regardless of which 2 of 8 are chosen.

## 16.2 Object Pooling

- `objectPool.js` provides generic pools for the highest-churn entity types: `Hitbox`, `Projectile`, `ParticleEmitter`, and their associated Pixi display objects. Pool size is pre-warmed at scene load (e.g., 20 hitboxes, 100 particle sprites) based on observed peak concurrent counts from internal playtesting, with graceful overflow (dynamically allocate, then return to pool on next release) rather than a hard cap that drops VFX.
- Ragdoll bodies are *not* pooled (low frequency — at most 2 per match, end-of-round only) — pooling overhead isn't justified there.

## 16.3 Particle Optimization

- All weather and impact particles render through `PIXI.ParticleContainer`, which forgoes per-child transform/alpha/tint flexibility in exchange for a single batched draw call — the global particle budget cap (200 concurrent, Section 12) is enforced in `ParticleSystem` by recycling the oldest emitter's particles when the cap is hit rather than refusing new spawns outright (visual continuity over hard cutoffs).
- Particle update math (position integration, fade-out alpha) is done in a tight typed-array loop rather than per-object Pixi property writes where possible, minimizing per-frame GC pressure.

## 16.4 Rendering Optimization

- `roundPixels: true` and integer-only camera/sprite positioning avoid sub-pixel shimmer common in pixel-art at non-native scale, while also being cheaper to rasterize.
- Static/rarely-changing layers (background far/mid layers) are flagged `cacheAsBitmap`-equivalent (render-textured once) when they contain no per-frame animation, eliminating redundant vector-redraw cost for purely static art.
- Off-screen entities (relevant mainly if camera ever zooms/pans in future modes) are skipped in `RenderSyncSystem` via a simple AABB-vs-viewport cull, though for the fixed-camera 1v1 battle format this mostly matters for fully-resolved Ultimate VFX that may temporarily exceed viewport bounds.
- Hitstop (brief global time-freeze on impactful hits, ~80–120ms) is implemented by skipping fixed-step *simulation* advances while still rendering, so it never desyncs the deterministic tick count — purely a render/feel trick layered on top of 4.7's loop, not a separate game-state.


---

# 17. Multiplayer Readiness

The single-player architecture is deliberately structured so a future online mode requires *adding* a network layer, not rewriting gameplay code.

## 17.1 Why This Architecture Is Multiplayer-Ready Already

- `combat-core/` and `ai/` are pure, framework-agnostic JS with no DOM/Pixi/Matter imports — directly importable into a Node.js server process unmodified.
- The fixed-timestep, deterministic simulation (4.7) means identical inputs reliably produce identical outputs — the prerequisite for both lockstep and rollback netcode models.
- `InputController`/`AIController` are both just producers of the same abstract "intent" data consumed by `ActionResolutionSystem` — a future `NetworkInputController` slots into the exact same interface.

## 17.2 Recommended Network Model

**Rollback netcode** (GGPO-style) is recommended over deterministic lockstep for a 1v1 fighting game, since it best preserves input responsiveness over imperfect internet connections:

```
┌──────────┐   local input, applied immediately      ┌──────────┐
│ Client A │ ───────────────────────────────────────▶│ predicted │
└────┬─────┘                                          │  state    │
     │  send input over UDP/WebRTC datachannel        └─────┬─────┘
     ▼                                                       │
┌──────────┐   remote input arrives (delayed)                │
│ Client B │ ──────────────────────────────────────▶ if mismatch:
└──────────┘                                           rollback to last
                                                        confirmed frame,
                                                        re-simulate forward
                                                        with corrected input
```

## 17.3 Authoritative Server Role

Initial online release can run **peer-to-peer rollback for ranked/casual matches** (lower infra cost, proven fighting-game pattern) with a thin **matchmaking + relay server** (no gameplay authority) brokering connections; a fully authoritative server simulating the match itself is a *later* hardening step (primarily an anti-cheat measure for any future ranked ladder with stakes) and would reuse the exact same `combat-core` + ECS systems server-side in headless mode (no PixiJS, no Matter render step — Matter's solver can still run headless for ragdoll/knockback if needed, or be replaced server-side with the same kinematic-vector approach already used for knockback in 11.4).

## 17.4 Prediction & Reconciliation

- Each client runs the full simulation locally for *both* players every tick, predicting the remote player's input as "repeat last known input" until the real input arrives.
- On receiving a remote input that differs from the prediction, the client rolls back to the last confirmed simulation frame (kept via lightweight state snapshots — feasible because ECS component data is small, plain-data objects, cheap to snapshot/restore) and re-simulates forward with the corrected input history, applying all the same deterministic systems (4.7) — visually smoothed via the existing render-interpolation already built for the single-player fixed-timestep loop.
- Because `combat-core` resolution is a pure function of inputs+state (10.4–10.8), re-simulation after rollback produces bit-identical results to a "perfect information" run, which is the core correctness guarantee rollback netcode depends on.

## 17.5 What Must Change Later (explicitly out of scope for Phase 1–3)

Input serialization/transport layer, a snapshot/rollback buffer manager, matchmaking server, and a headless server build target. None of these require modifying `combat-core/`, `ai/` (replaced by remote input, not removed), or the ECS system list — they are additive modules.


---

# 18. Development Roadmap

## Phase 0 — Foundation & Tooling (no gameplay yet)
- **Goal**: project scaffolding, rendering/physics bootstrapping, CI-ready test harness.
- **Deliverables**: Vite project with PixiJS app boot (blank arena-colored screen at correct resolution/scaling), Matter.js world initialized with a static ground body, ECS `World` with entity/component CRUD + query benchmarked against a synthetic 50-entity stress test, fixed-timestep `GameLoop` proven via a console-logged tick counter, unit test runner configured.
- **Dependencies**: none (first phase).
- **Risks**: under-scoping the ECS query API now causes painful refactors later — mitigate by writing the `MovementSystem` and `CombatSystem` *stubs* against the API in this phase to validate ergonomics before content work begins.
- **Estimated time**: 1–1.5 weeks (1 engineer).

## Phase 1 — Core Movement & One Playable Character (gray-box)
- **Goal**: a single placeholder character (programmer-art rectangle/sprite) that walks/runs/jumps/double-jumps/dashes/rolls correctly on a flat gray-box arena, fully matching Section 11's movement model.
- **Deliverables**: `MovementSystem`, `platformerMovement.js`, `InputController`+`InputBindings`, camera/viewport scaling finalized, all 6 movement actions feel-tuned and unit/manual-tested.
- **Dependencies**: Phase 0 ECS + loop.
- **Risks**: movement "feel" tuning is subjective and iterative — budget explicit playtesting passes, not just implementation time.
- **Estimated time**: 1.5–2 weeks.

## Phase 2 — Combat Core (gray-box, single dummy target)
- **Goal**: Light/Heavy/Combo/Air/Dash attacks, Block/Parry/Counter, and the full damage/knockback/hitstun pipeline against a static or simple-AI dummy, using placeholder square hitboxes.
- **Deliverables**: `combat-core/` fully implemented + unit tested in isolation, `CombatSystem`/`HitDetectionSystem`/`DamageResolutionSystem`/`ComboTrackingSystem`/`UltimateMeterSystem`, one placeholder "sword" data file to validate the data-driven stat-modifier pipeline end to end.
- **Dependencies**: Phase 1 movement (for Dash Attack/Air Attack/Roll-cancel interactions), Phase 0 ECS.
- **Risks**: combo-scaling/hitstun-cap balance is easy to get wrong (either trivially escapable or true-infinite) — mitigate with an automated test that simulates N consecutive combo extensions and asserts damage approaches but never reaches 100% of opponent HP from a single unbroken juggle.
- **Estimated time**: 2.5–3 weeks.

## Phase 3 — Single AI Opponent (Medium difficulty only) + One Real Arena
- **Goal**: prove the full Phase 1+2 loop is fun against a thinking opponent in a real, art-complete arena (Forest Temple recommended as the simplest/cheapest arena).
- **Deliverables**: `ai/` BehaviorTree + FSM at Medium-only tuning, Forest Temple full art pass (Section 12) integrated, Battle HUD MVP (health bars only, no combo counter/timer yet).
- **Dependencies**: Phase 2 combat core, Phase 1 movement.
- **Risks**: this is the first "is this game actually fun" checkpoint — treat it as a hard go/no-go gate before investing in full content scale (4 characters × 8 swords × 5 arenas).
- **Estimated time**: 2 weeks.

## Phase 4 — Full Character Roster (4 characters, real art + animation)
- **Goal**: replace placeholder art with all 4 characters' full animation sets (Section 7.2) and stat profiles (Section 8), each independently playable and balance-passable against each other.
- **Deliverables**: 4 character data files, ~520 character animation frames integrated, `AnimationStateSystem` validated against all 4 characters' unique skill interactions (Shield-Bash super-armor, Iaijutsu Counter window, Shadow Step i-frames, Arcane Reservoir mana economy).
- **Dependencies**: Phase 3's proven core loop.
- **Risks**: 4× the animation integration surface area is the single largest art-pipeline risk in the project — mitigate by building one character fully end-to-end (art→data→test) before parallelizing the remaining 3 across multiple artists/engineers.
- **Estimated time**: 4–5 weeks.

## Phase 5 — Full Sword Roster (8 swords) + Magic/Elemental System
- **Goal**: all 8 swords with stat modifiers, special abilities, ultimates, and the 5-element status-effect system (Burning/Frozen/Shocked/Hexed/Armor Break) fully implemented.
- **Deliverables**: 8 sword data files, socket-based sword-attachment rendering (Section 7.3), `StatusEffectSystem`, elemental VFX (shared base + per-sword flourish).
- **Dependencies**: Phase 4 (sword loadouts apply on top of finished characters), Phase 2 combat-core (specials/ultimates extend the same DamagePacket pipeline).
- **Risks**: 32 character×sword combinations is a large balance-testing matrix — mitigate with the automated damage-formula test fixture (10.4) covering all 32 pairings against a standard "punching bag" scenario, flagging any pairing whose time-to-kill falls outside a defined acceptable band.
- **Estimated time**: 4 weeks.

## Phase 6 — Remaining Arenas, Full AI Difficulty Range, Full UI
- **Goal**: Frozen Mountain/Volcano/Dark Castle/Sky Kingdom art-complete; Easy/Hard/Nightmare AI tuning; all UI screens (Section 14) wired end-to-end including Character/Sword/Arena Select and Results.
- **Deliverables**: 4 additional arenas, AI difficulty profile tuning + adaptive-behavior model (Hard/Nightmare), full menu flow, HUD complete (combo counter, timer, ultimate-ready glow).
- **Dependencies**: Phase 3 (arena pipeline proven), Phase 5 (swords needed for Sword Select UI), Phase 4 (characters needed for Character Select UI).
- **Risks**: Nightmare AI tuning can balloon in iteration time chasing "frame-perfect" feel — timebox tuning passes and accept "very strong" over a perfect, possibly-unfun wall.
- **Estimated time**: 4 weeks.

## Phase 7 — Audio Integration, Save/Progression System, Polish Pass
- **Goal**: full audio (Section 7.6/4.9), Save System with unlocks/achievements (Section 15), screen-shake/hitstop/juice pass, performance profiling against the 60 FPS target (Section 16).
- **Deliverables**: `AudioEngine` + all SFX/music integrated, `SaveManager` + achievement tracking live, profiling report with before/after frame-time on a defined "worst case" scene (both Ultimate VFX active simultaneously, max particle budget).
- **Dependencies**: all prior phases (this phase touches every system as an integration/polish layer).
- **Risks**: polish work is open-ended by nature — define a fixed punch-list and time-box rather than open-ended "make it feel good" iteration.
- **Estimated time**: 3 weeks.

## Phase 8 — QA, Balance Pass, Launch Readiness
- **Goal**: full regression test pass, external playtesting on the complete 32-loadout × 5-arena × 4-AI-difficulty matrix, final balance adjustments via data-file tuning only (no code changes expected).
- **Deliverables**: bug-fix backlog cleared to a defined severity bar, balance-change changelog, build pipeline verified for production deploy.
- **Dependencies**: Phase 7 complete (feature-complete build required for meaningful QA).
- **Risks**: balance changes discovered late may reveal architecture gaps if a fix can't be expressed as a data-file change — this is the primary signal that Section 5/9's data-driven design held up under real content load.
- **Estimated time**: 2–3 weeks.

**Total estimated timeline: ~24–28 weeks (≈6–7 months)** for a small team (assume 2–3 engineers, 1–2 artists, 1 sound designer/composer contracted or licensed-asset-driven), Phase 0–3 single-threaded as the critical-path "is the core fun" gate, Phases 4–6 parallelizable across content workstreams once that gate is cleared.


---

# 19. Implementation Task Breakdown

Format: `Epic └ Feature └ Task └ Subtask (est. hours)`. Hours are engineering-time estimates for an experienced JS/game developer; art/audio asset-creation hours are tracked separately in Section 7 and not duplicated here.

```
EPIC 1: Engine Foundation
 └ Feature 1.1: Rendering Bootstrap
     └ Task 1.1.1: PixiJS Application setup
         └ Subtask: Configure resolution/scaling/NEAREST scale mode (3h)
         └ Subtask: Build layered Container hierarchy (4.2) (4h)
         └ Subtask: Implement assetLoader.js bundle manifest loading (5h)
     └ Task 1.1.2: Fixed-timestep game loop
         └ Subtask: Accumulator + interpolation implementation (4.7) (6h)
         └ Subtask: Hitstop integration without desyncing tick count (3h)
 └ Feature 1.2: ECS Core
     └ Task 1.2.1: World/Entity/Component registry
         └ Subtask: Component storage (typed arrays or Map-based) (8h)
         └ Subtask: Query API (by component signature) (6h)
         └ Subtask: Entity pooling integration hooks (3h)
     └ Task 1.2.2: System pipeline runner
         └ Subtask: Ordered system execution per Section 5.4 (4h)
         └ Subtask: EventBus for cross-system decoupled events (5h)
 └ Feature 1.3: Physics Bootstrap
     └ Task 1.3.1: Matter.js world init, collision categories (5h)
     └ Task 1.3.2: Static arena geometry loader (Tiled-style JSON → Matter bodies) (6h)

EPIC 2: Movement System
 └ Feature 2.1: Core Locomotion
     └ Task 2.1.1: Walk/Run with accel/decel curves (6h)
     └ Task 2.1.2: Jump + Double Jump charge management (5h)
     └ Task 2.1.3: Gravity + fast-fall implementation (3h)
     └ Task 2.1.4: Grounded/airborne raycast detection (4h)
 └ Feature 2.2: Advanced Movement
     └ Task 2.2.1: Dash (distance, cancel-into-attack hook) (5h)
     └ Task 2.2.2: Roll (i-frame sub-window, no attack-cancel) (5h)
     └ Task 2.2.3: Character-specific movement variants (Shadow Step, etc.) (6h)

EPIC 3: Combat Core
 └ Feature 3.1: Pure Combat Math (combat-core/)
     └ Task 3.1.1: damageFormula.js + unit test fixture table (8h)
     └ Task 3.1.2: knockbackFormula.js + hitstun cap logic (6h)
     └ Task 3.1.3: comboScaling.js (damage scalar, juggle limit) (5h)
     └ Task 3.1.4: parryWindow.js (timing window, fail-state) (5h)
     └ Task 3.1.5: ultimateResolution.js (meter math, super-armor flags) (6h)
 └ Feature 3.2: Combat ECS Integration
     └ Task 3.2.1: CombatSystem — hitbox spawning from animation frame data (8h)
     └ Task 3.2.2: HitDetectionSystem — broad+narrow phase overlap (8h)
     └ Task 3.2.3: DamageResolutionSystem — apply mutations from combat-core output (6h)
     └ Task 3.2.4: ComboTrackingSystem (5h)
     └ Task 3.2.5: UltimateMeterSystem (4h)
     └ Task 3.2.6: StatusEffectSystem (Burning/Frozen/Shocked/Hexed/Armor Break) (10h)
 └ Feature 3.3: Attack Action Set
     └ Task 3.3.1: Light/Heavy/Combo chain state machine (10.1) (10h)
     └ Task 3.3.2: Air Attack + juggle-limit enforcement (6h)
     └ Task 3.3.3: Dash Attack (4h)
     └ Task 3.3.4: Block + chip-damage handling (5h)
     └ Task 3.3.5: Parry + Counter-Attack window (8h)

EPIC 4: Character Implementation
 └ Feature 4.1: Data Pipeline
     └ Task 4.1.1: Character data schema + loader (5h)
     └ Task 4.1.2: Animation clip JSON schema + embedded hitbox authoring tool/script (10h)
 └ Feature 4.2: Per-Character Integration (×4, repeat per character)
     └ Task 4.2.X: Knight integration
         └ Subtask: Wire all animation clips to AnimatedSprite (6h)
         └ Subtask: Implement Shield-Bash super-armor flag handling (4h)
         └ Subtask: Implement Fortify passive (knockback reduction) (3h)
     └ Task 4.2.X: Samurai integration (analogous, incl. Iaijutsu Counter) (13h)
     └ Task 4.2.X: Assassin integration (analogous, incl. Shadow Step + Glass Cannon) (13h)
     └ Task 4.2.X: Mage Warrior integration (analogous, incl. Arcane Reservoir + Elemental Echo) (13h)

EPIC 5: Sword & Magic System
 └ Feature 5.1: Sword Data & Attachment
     └ Task 5.1.1: Sword data schema (stat modifiers, special/ultimate refs) (5h)
     └ Task 5.1.2: Socket-based sword-attachment renderer (per-frame anchor data) (8h)
 └ Feature 5.2: Per-Sword Special/Ultimate (×8, repeat per sword)
     └ Task 5.2.X: Implement special-move behavior + VFX hook (avg. 5h × 8 = 40h)
     └ Task 5.2.X: Implement ultimate behavior + VFX hook (avg. 7h × 8 = 56h)
 └ Feature 5.3: Elemental Status Effects
     └ Task 5.3.1: Burning DOT (4h)
     └ Task 5.3.2: Frozen slow/stun (4h)
     └ Task 5.3.3: Shocked interrupt-chance (5h)
     └ Task 5.3.4: Hexed defense-down (3h)
     └ Task 5.3.5: Armor Break / chip-ignore (4h)

EPIC 6: AI System
 └ Feature 6.1: Behavior Tree Framework
     └ Task 6.1.1: Generic BT runner + node interface (8h)
     └ Task 6.1.2: Core nodes: Punish/LowHP/Spacing/Zone/Pressure (12h)
 └ Feature 6.2: FSM Execution Layer
     └ Task 6.2.1: Approach/Footsies/CommitAttack/Recover/Retreat/Defend states (10h)
     └ Task 6.2.2: Wire FSM output into shared ActionResolutionSystem entry points (6h)
 └ Feature 6.3: Difficulty Tuning
     └ Task 6.3.1: difficultyProfiles.js data tables (Section 13.2) (4h)
     └ Task 6.3.2: Adaptive opponent-model (rolling action window, Hard/Nightmare) (10h)

EPIC 7: Arena System
 └ Feature 7.1: Arena Data & Rendering (×5, repeat per arena)
     └ Task 7.1.X: Layer container setup + parallax factors (4h each = 20h)
     └ Task 7.1.X: Weather/particle emitter config (5h each = 25h)
     └ Task 7.1.X: Collision geometry authoring + Matter static body generation (4h each = 20h)

EPIC 8: UI System
 └ Feature 8.1: HUD
     └ Task 8.1.1: Health/Mana/Ultimate bar components incl. ghost-segment depletion (8h)
     └ Task 8.1.2: Combo counter + round timer (5h)
 └ Feature 8.2: Menu Screens
     └ Task 8.2.1: Main Menu (4h)
     └ Task 8.2.2: Character Select w/ live preview (8h)
     └ Task 8.2.3: Sword Select w/ stat-delta preview (8h)
     └ Task 8.2.4: Arena Select w/ hover preview (5h)
     └ Task 8.2.5: Results Screen w/ achievement toast (6h)
     └ Task 8.2.6: Settings screen (audio/controls/display) (6h)

EPIC 9: Audio
 └ Feature 9.1: Engine
     └ Task 9.1.1: WebAudio bus management (music/sfx/ui) (6h)
     └ Task 9.1.2: Spatial pan/falloff implementation (5h)
     └ Task 9.1.3: Pooled SFX source reuse (4h)
 └ Feature 9.2: Integration
     └ Task 9.2.1: Wire combat/movement/UI events to AudioEventSystem triggers (8h)
     └ Task 9.2.2: Music crossfade on scene transitions (4h)

EPIC 10: Save & Progression
 └ Feature 10.1: Save Manager
     └ Task 10.1.1: Schema + versioned migrations (6h)
     └ Task 10.1.2: Debounced write + localStorage failure fallback (4h)
 └ Feature 10.2: Unlocks & Achievements
     └ Task 10.2.1: Unlock-condition pure functions (Section 15.2) (6h)
     └ Task 10.2.2: Achievement counter tracking via SaveTickSystem (5h)

EPIC 11: Physics — Knockback & Ragdoll
 └ Feature 11.1: Knockback hand-off (kinematic mode switch, 11.4) (6h)
 └ Feature 11.2: Ragdoll compound body + constraints (11.5) (8h)
 └ Feature 11.3: Settle-detection + freeze-frame for Results (4h)

EPIC 12: Multiplayer Groundwork (architecture-only, Phase 1 of online — beyond initial roadmap)
 └ Feature 12.1: Input serialization format definition (5h)
 └ Feature 12.2: Snapshot/restore for ECS component data (8h)
 └ Feature 12.3: Headless server build target (no Pixi/render layer) (10h)

EPIC 13: QA & Tooling
 └ Feature 13.1: Unit test coverage for combat-core/, ai/, save/ (per Section 21 test plan)
 └ Feature 13.2: Integration smoke tests (full-tick headless simulation)
 └ Feature 13.3: Balance-matrix automated test (32 character×sword pairings, TTK band check)
```

**Rough total engineering effort (excluding art/audio production and open-ended QA/polish iteration):** ≈ 700–820 hours, consistent with the ~24–28 week / 2–3 engineer estimate in Section 18.


---

# 20. Risk Assessment

## 20.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Matter.js solver fighting custom platformer movement (jitter, sinking, tunneling) | Medium | High | Scope Matter.js strictly to hitbox queries/knockback/ragdoll (Section 4.3); never let its solver resolve fighter-vs-ground movement directly |
| Fixed-timestep simulation drifting out of sync with render interpolation, causing visible stutter | Low | Medium | Use the accumulator pattern (4.7) with render-only interpolation, never mutate gameplay state in the render step |
| ECS query performance degrading with entity count (many simultaneous hitboxes/particles) | Low | Medium | Object pooling (16.2) caps churn; benchmark query API in Phase 0 before content-scale commitment |
| Data-driven animation/hitbox JSON becoming a maintenance burden as content scales (32 sword×character combos) | Medium | Medium | Authoring tooling/scripts (Task 4.1.2) and automated balance-matrix tests (Task 13.3) catch regressions early |

## 20.2 Design Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Combo system allowing true-infinite juggles, breaking competitive integrity | Medium | High | Hard juggle limit (4 hits) + hitstun cap + automated combo-extension simulation test (Phase 2 risk note, Section 18) |
| Parry window too generous (degenerate "mash parry" meta) or too strict (never used) | Medium | Medium | 160ms window tuned via playtesting; failed-parry punishment (0.3s lock) calibrated to be real but not run-ending, encouraging experimentation |
| 32 character×sword combinations producing unbalanced outliers (e.g., one pairing dominating) | High (inherent to combinatorial content) | Medium | Automated TTK-band test across all 32 pairings (Task 13.3) flags outliers for manual balance pass before launch |
| Nightmare AI feeling "unfair" rather than "hard but fair" | Medium | Medium | Explicitly no stat buffs for AI (13.2) — difficulty is execution/decision-quality only, preserving perceived fairness |

## 20.3 Performance Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Weather particle systems (Frozen Mountain snow, Volcano embers) tanking frame rate on low-end devices | Medium | High | Global 200-particle cap via ParticleContainer + oldest-recycling policy (16.3) |
| Simultaneous dual Ultimate VFX (worst-case scene) exceeding draw-call/texture-memory budget | Medium | Medium | Profile this exact scenario explicitly in Phase 7 (Section 18) as the defined "worst case" benchmark |
| Texture atlas memory bloat from loading all 4 characters + 8 swords + 5 arenas simultaneously | Low (if bundles are scoped correctly) | Medium | Scene-scoped Assets bundles (16.1) load/unload per Character-Select/Battle transition, not all-at-once |

## 20.4 Asset Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ~520 character frames + ~360 sword/VFX frames + ~400 arena frames is a large art budget for a small team | High | High | Socket-based sword attachment (7.3) avoids redrawing every character animation per sword — the single biggest art-budget saving lever in this spec |
| Animation timing data (embedded hitbox frames) requiring tight art/engineering iteration loops | Medium | Medium | Data-driven JSON (4.4) lets engineers/designers tune hit timing without re-exporting art; build the authoring script (Task 4.1.2) early |
| Audio licensing/production for 8 music tracks + ~70 SFX variants slipping schedule | Medium | Low–Medium | Audio integration is scheduled in its own dedicated Phase 7 slot, decoupled from gameplay-code critical path |

---

# 21. Implementation Instructions For Claude Code

This section is written as a direct, sequential build order for an autonomous coding agent. Follow it phase-by-phase; do not skip ahead to later modules before the validation criteria for the current module pass. Each module lists: build order, dependencies, required tests, and the validation gate before proceeding.

## 21.1 Build Order (authoritative — follow exactly)

```
1.  Project scaffold (Vite + package.json + folder structure per Section 6)
2.  ECS core (World/Entity/Component/Query) — no gameplay yet
3.  Fixed-timestep GameLoop + PixiJS Application bootstrap (blank colored screen)
4.  Matter.js world bootstrap + static geometry loader
5.  combat-core/ pure functions (damageFormula, knockbackFormula, comboScaling,
    parryWindow, ultimateResolution) — written and unit-tested BEFORE any ECS
    integration, since these have zero framework dependencies
6.  MovementSystem + platformerMovement.js (placeholder rectangle sprite)
7.  InputController + InputBindings (keyboard first; gamepad can follow)
8.  CombatSystem + HitDetectionSystem + DamageResolutionSystem wired to
    combat-core (still placeholder rectangle vs. static dummy target)
9.  ComboTrackingSystem + UltimateMeterSystem + StatusEffectSystem
10. AnimationStateSystem (data-driven clip + frame-embedded hitbox loader)
11. One real character's full data + art integration (recommend Knight first
    — simplest skill set, no projectile/teleport edge cases)
12. AIDecisionSystem (BehaviorTree + FSM) at Medium-difficulty tuning only
13. One real arena (recommend Forest Temple — fewest weather/particle
    edge cases) with collision geometry
14. Minimal HUD (health bars only)
    --- GO/NO-GO CHECKPOINT: full playable loop, 1 character, 1 arena,
        1 AI difficulty. Validate fun/feel before proceeding. ---
15. Remaining 3 characters (parallel-safe once step 11's pipeline is proven)
16. Sword data schema + socket-attachment renderer + all 8 swords'
    special/ultimate behaviors + 5-element StatusEffectSystem entries
17. Remaining 4 arenas (parallel-safe)
18. Full AI difficulty range (Easy/Hard/Nightmare) + adaptive opponent model
19. Full UI (Character/Sword/Arena Select, Results, Settings)
20. AudioEngine + SFX/music integration
21. SaveManager + achievements/unlocks
22. Performance pass against Section 16 targets
23. Full regression/balance-matrix test pass (Section 13.3/20.2)
```

## 21.2 Dependency Rules (must be respected by the build order above)

- **Never** import PixiJS or Matter.js inside `combat-core/` or `ai/` — these must remain pure and portable. If a coding agent finds itself wanting to do this, that is a signal the abstraction boundary is being violated; stop and restructure instead.
- **Never** let `CombatSystem`/`MovementSystem` read or write Pixi `Sprite` objects directly — they operate only on ECS components; `RenderSyncSystem` (last in the pipeline, Section 5.4 step 17) is the sole system permitted to touch Pixi display objects for gameplay entities.
- **Never** allow `UISystem` to mutate `Health`/`Mana`/`UltimateMeter`/`ComboState` — it is read-only by contract (Section 14.3). If a UI feature seems to require mutating gameplay state, route it through an explicit `EventBus` event consumed by the appropriate gameplay system instead.
- **Always** implement a system's corresponding unit/integration test in the same work session it is built, not deferred — `combat-core/` in particular must reach test coverage before any ECS system consumes it, since downstream systems will be tested against its already-verified behavior, not re-deriving correctness.
- AI (`AIController`) must produce its "virtual input" through the exact same `ActionResolutionSystem` entry point a human's `InputController` does — do not create an AI-only fast-path that bypasses Stamina/Mana/cooldown checks.

## 21.3 Required Tests Per Module (write these, not just "consider" them)

| Module | Required Tests |
|---|---|
| `combat-core/damageFormula.js` | Fixture table covering all 4 characters × representative sword stat sets; assert exact expected output for base hit, crit hit, and Defense-reduced hit |
| `combat-core/knockbackFormula.js` | Assert hitstun never exceeds `HITSTUN_CAP` regardless of input combo-stage bonus; assert knockback scales inversely with `defenderWeight` |
| `combat-core/comboScaling.js` | Simulate a 10-hit unbroken combo chain; assert cumulative damage stays below a defined ceiling (no true-infinite) |
| `combat-core/parryWindow.js` | Assert a hit landing exactly at window-boundary frame is correctly classified parried/not-parried (off-by-one frame is a common bug here) |
| ECS `World` query API | Stress test with 200+ entities of mixed component signatures; assert query returns exactly the matching set with no false positives/negatives |
| `MovementSystem` | Assert double-jump charge resets only on landing/wall-touch, never mid-air without one of those events |
| `HitDetectionSystem` | Assert a single Hitbox cannot register two hits against the same target unless explicitly authored as multi-hit (`hitTargets` set behavior) |
| `AIDecisionSystem` | Assert difficulty-profile parameters (Section 13.2) are actually read and applied (not hardcoded to one tier) — test all 4 tiers produce measurably different reaction-delay/accuracy behavior in a scripted scenario |
| `SaveManager` | Assert a corrupted/missing localStorage value falls back to defaults without throwing; assert a schema migration from v0→v1 (synthetic) preserves existing unlock flags |
| Integration: full-tick headless simulation | Run N simulated ticks with scripted input sequences (no Pixi/Matter render, logic only) and assert final Health/ComboState/UltimateMeter values match hand-computed expected values for at least 3 known input scripts |

## 21.4 Validation Gate Before Each Phase Transition

Do not proceed to the next numbered build-order step until:
1. All required tests for the current step's module(s) pass.
2. No system outside the permitted dependency boundaries (21.2) has been touched.
3. For steps 11/13/14 specifically: a manual playable build exists and the GO/NO-GO checkpoint after step 14 has been explicitly confirmed before parallelizing remaining character/sword/arena content (steps 15–17) — building all 32 character×sword combinations against an unproven core loop is the single highest-cost mistake this plan is designed to prevent.
4. Any new data file added (character/sword/arena JSON) validates against its schema (reject malformed data at load time with a clear error, never silently default).

## 21.5 Notes for the Coding Agent

- Build `combat-core/` and write its tests *before* writing the ECS systems that call it — this gives a verified-correct foundation that later systems can be tested *against* rather than everything being verified simultaneously, which is harder to debug.
- When in doubt about a numeric balance value not explicitly specified above (e.g., an exact Stamina cost), choose a value consistent with the stated design intent (Section 3.2's pillars) and flag it in code comments as `// BALANCE: placeholder, needs playtest tuning` rather than guessing silently — these are expected to be tuned later via data files only, never requiring code changes.
- This document does not include actual code. The next step after this plan is approved is to begin Build Order step 1 (project scaffold) as a separate, explicit implementation task.