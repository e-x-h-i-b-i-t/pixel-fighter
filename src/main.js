import { PixiApp } from './rendering/PixiApp.js';
import { createRenderLayers } from './rendering/layers.js';
import { GameLoop } from './core/GameLoop.js';
import { World } from './ecs/World.js';

import { MatterWorld } from './physics/MatterWorld.js';
import { InputSystem } from './systems/02-input/InputSystem.js';
import { aiSystem } from './systems/01-ai/AISystem.js';
import { actionResolutionSystem } from './systems/03-action/ActionResolutionSystem.js';
import { movementSystem } from './systems/04-movement/MovementSystem.js';
import { physicsPostUpdateSystem } from './systems/05-physics/PhysicsPostUpdateSystem.js';
import { hitDetectionSystem } from './systems/08-combat/HitDetectionSystem.js';
import { damageResolutionSystem } from './systems/09-combat/DamageResolutionSystem.js';
import { comboTrackingSystem } from './systems/10-resources/ComboTrackingSystem.js';
import { statusEffectSystem } from './systems/10-resources/StatusEffectSystem.js';
import { animationStateSystem } from './systems/11-animation/AnimationStateSystem.js';
import { renderSyncSystem } from './systems/17-render/RenderSyncSystem.js';
import { HudSystem } from './systems/18-hud/HudSystem.js';
import { lifetimeSystem } from './systems/12-lifetime/LifetimeSystem.js';

import { loadCharacter } from './core/characterLoader.js';
import { equipSword } from './core/swordLoader.js';
import { loadArena } from './core/arenaLoader.js';
import { UIManager } from './core/UIManager.js';
import { ComponentTypes } from './ecs/componentTypes.js';
import { audioEngine } from './core/AudioEngine.js';
import { saveManager } from './core/SaveManager.js';
import { RLAgent } from './ai/RLAgent.js';
import { RewardCalculator } from './ai/RewardCalculator.js';
import { encodeState } from './ai/StateEncoder.js';
import { RLSyncService } from './ai/RLSyncService.js';

/**
 * Updates the RL stats panel DOM elements during an adaptive match.
 * @param {{ matchCount: number, statesKnown: number, epsilon: string }|null} stats
 * @param {boolean} visible
 */
function updateRLStatsPanel(stats, visible) {
  const panel = document.getElementById('rl-stats-panel');
  if (!panel) return;
  if (!visible || !stats) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const mc = document.getElementById('rl-matches');
  const sk = document.getElementById('rl-states');
  const ep = document.getElementById('rl-epsilon');
  if (mc) mc.textContent = stats.matchCount;
  if (sk) sk.textContent = stats.statesKnown;
  if (ep) ep.textContent = stats.epsilon;
}


document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize PixiJS Application
  const pixiApp = new PixiApp();

  const layers = createRenderLayers(pixiApp.gameplayViewport);
  pixiApp.layers = layers;

  // 2. Game orchestration state
  let world = new World();
  let physics = new MatterWorld();
  const inputSystem = new InputSystem();
  let hudSystem = null;
  let uiManager = null;

  // ── RL Agent (persistent across matches) ────────────────────────────────
  const rlAgent      = new RLAgent(saveManager.loadQTable());
  const rewardCalc   = new RewardCalculator();
  let   rlDifficulty = false; // true when current match uses adaptive AI
  let   rlPrevState  = null;  // state key from previous tick

  const matchState = {
    active: false,
    paused: false,
    playerEntityId: null,
    aiEntityId: null,
    startTime: 0,
    winConditionChecked: false,
    stats: {
      durationMs: 0,
      hitsLanded: 0,
      maxCombo: 0,
      damageDealt: 0,
      ultimatesCast: 0
    }
  };

  let playerUltWasReady = false;
  let hitstopTicks = 0;

  const triggerHitstop = (durationMs) => {
    hitstopTicks = Math.ceil(durationMs / 16.6);
  };

  // 3. Match Initialization
  const startMatch = (p1Opts, p2Opts, arenaId) => {
    // Reset state & engines
    matchState.active = false;
    matchState.paused = false;
    matchState.winConditionChecked = false;
    matchState.stats = {
      durationMs: 0,
      hitsLanded: 0,
      maxCombo: 0,
      damageDealt: 0,
      ultimatesCast: 0
    };
    playerUltWasReady = false;
    hitstopTicks = 0;

    // Clear old ECS entities & Physics bodies
    world.clear();
    physics.clear();

    if (layers && layers.entityLayer) {
      layers.entityLayer.removeChildren();
    }

    // Clear Hud if exists
    if (hudSystem) {
      hudSystem.destroy();
      hudSystem = null;
    }

    // Load Arena
    loadArena(arenaId, physics, pixiApp);

    // Spawn Player P1
    const player = world.createEntity();
    loadCharacter(world, player, physics, p1Opts.class, 250, 150, true);
    equipSword(world, player, p1Opts.sword);

    // Spawn AI P2
    const ai = world.createEntity();
    loadCharacter(world, ai, physics, p2Opts.class, 900, 150, false);
    equipSword(world, ai, p2Opts.sword);
    
    // Configure AI difficulty level
    const aiController = world.getComponent(ai, ComponentTypes.AI_CONTROLLER);
    if (aiController) {
      aiController.difficulty = p2Opts.difficulty;
    }

    matchState.playerEntityId = player;
    matchState.aiEntityId = ai;
    matchState.startTime = Date.now();

    // ── RL: initialise reward baseline for this match ──────────────────────
    rlDifficulty = p2Opts.difficulty === 'adaptive';
    if (rlDifficulty) {
      const aiH  = world.getComponent(ai,     ComponentTypes.HEALTH);
      const plH  = world.getComponent(player, ComponentTypes.HEALTH);
      rewardCalc.reset(
        aiH ? aiH.current : 100,
        plH ? plH.current : 100
      );
      rlPrevState = null;
      // Fetch global Q-table from server (non-blocking — game starts while fetching)
      RLSyncService.fetchGlobalQTable().then(globalData => {
        if (globalData) rlAgent.initFromGlobal(globalData);
      });
      updateRLStatsPanel(rlAgent.getStats(), true);
    } else {
      updateRLStatsPanel(null, false);
    }

    // Add character sprites to PixiJS rendering layer
    const p1SpriteRef = world.getComponent(player, ComponentTypes.SPRITE_REF);
    if (p1SpriteRef && p1SpriteRef.sprite && layers.entityLayer) {
      layers.entityLayer.addChild(p1SpriteRef.sprite);
    }
    const p2SpriteRef = world.getComponent(ai, ComponentTypes.SPRITE_REF);
    if (p2SpriteRef && p2SpriteRef.sprite && layers.entityLayer) {
      layers.entityLayer.addChild(p2SpriteRef.sprite);
    }

    // Instantiate fresh HUD
    hudSystem = new HudSystem(pixiApp);

    matchState.active = true;

    // Start chiptune battle music
    audioEngine.startMusic();
  };

  // 4. Instantiate UIManager
  uiManager = new UIManager({
    onStartFight: (p1Opts, p2Opts, arenaId) => {
      startMatch(p1Opts, p2Opts, arenaId);
    },
    onResumeGame: () => {
      matchState.paused = false;
      uiManager.hidePause();
    },
    onQuitGame: () => {
      matchState.active = false;
      matchState.paused = false;
      if (hudSystem) {
        hudSystem.destroy();
        hudSystem = null;
      }
      world.clear();
      physics.clear();
      audioEngine.stopMusic();
    }
  });

  // Esc key listener for Pause Menu
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && matchState.active && !matchState.winConditionChecked) {
      matchState.paused = !matchState.paused;
      if (matchState.paused) {
        uiManager.showPause();
      } else {
        uiManager.hidePause();
      }
    }
  });

  // 5. Game Loop callbacks
  const update = (dt) => {
    if (!matchState.active || matchState.paused) return;

    // Hitstop freeze tick
    if (hitstopTicks > 0) {
      hitstopTicks--;
      return;
    }

    const player = matchState.playerEntityId;
    const ai = matchState.aiEntityId;

    // Track statistics: hits & damage before resolution ticks
    const aiHealth = world.getComponent(ai, ComponentTypes.HEALTH);
    const oldAiHp = aiHealth ? aiHealth.current : 0;
    
    if (aiHealth && aiHealth.incomingHits) {
      const playerHits = aiHealth.incomingHits.filter(h => h.attackerId === player).length;
      matchState.stats.hitsLanded += playerHits;
    }

    // Run ECS Input & AI Systems
    inputSystem.update(world, dt);
    aiSystem(world, rlDifficulty ? rlAgent : null);

    // ── RL: per-tick Q-update ──────────────────────────────────────────────
    if (rlDifficulty) {
      const aiH  = world.getComponent(ai,     ComponentTypes.HEALTH);
      const plH  = world.getComponent(player, ComponentTypes.HEALTH);
      const reward    = rewardCalc.computeTickReward(
        aiH ? aiH.current : 0,
        plH ? plH.current : 0
      );
      const nextState = encodeState(world, ai, player);
      if (rlPrevState && rlAgent.lastAction && nextState) {
        rlAgent.update(rlPrevState, rlAgent.lastAction, reward, nextState);
      }
      rlPrevState = nextState;
      updateRLStatsPanel(rlAgent.getStats(), true);
    }

    // Resolve Actions
    actionResolutionSystem(world, physics);

    // Track Ultimates Cast
    const playerUlt = world.getComponent(player, ComponentTypes.ULTIMATE_METER);
    if (playerUlt) {
      if (playerUlt.isReady) {
        playerUltWasReady = true;
      } else if (playerUltWasReady) {
        matchState.stats.ultimatesCast++;
        playerUltWasReady = false;
      }
    }

    // Movement & Physics
    movementSystem(world, dt, physics);
    physics.update(dt); // Step Matter engine (dt already in ms from GameLoop)
    physicsPostUpdateSystem(world, physics);

    // Combat overlaps
    hitDetectionSystem(world, physics);

    // Resolve Damage
    damageResolutionSystem(world, triggerHitstop);

    // Track Damage Dealt from health change
    const newAiHp = aiHealth ? aiHealth.current : 0;
    const damageDealtThisTick = oldAiHp - newAiHp;
    if (damageDealtThisTick > 0) {
      matchState.stats.damageDealt += damageDealtThisTick;
    }

    // Resources & Stats
    comboTrackingSystem(world);
    statusEffectSystem(world);
    lifetimeSystem(world);

    // Track Max Combo
    const playerCombo = world.getComponent(player, ComponentTypes.COMBO_STATE);
    if (playerCombo) {
      matchState.stats.maxCombo = Math.max(matchState.stats.maxCombo, playerCombo.chainIndex);
    }

    // Mid-game Achievements Check
    if (matchState.stats.hitsLanded >= 1) {
      saveManager.unlockAchievement('firstBlood');
    }
    if (matchState.stats.maxCombo >= 5) {
      saveManager.unlockAchievement('comboMaster');
    }
    if (matchState.stats.maxCombo >= 10) {
      saveManager.unlockAchievement('comboLegend');
    }
    const aiStatus = world.getComponent(ai, ComponentTypes.STATUS_EFFECTS);
    if (aiStatus && aiStatus.active && aiStatus.active.length > 0) {
      saveManager.unlockAchievement('elementalStrike');
    }

    // Animation Machine
    animationStateSystem(world);

    // UI HUD Update
    if (hudSystem) {
      hudSystem.update(world);
    }

    // Win/Loss evaluations
    const playerHealth = world.getComponent(player, ComponentTypes.HEALTH);
    if (playerHealth && aiHealth && !matchState.winConditionChecked) {
      if (playerHealth.current <= 0 || aiHealth.current <= 0) {
        matchState.winConditionChecked = true;
        matchState.stats.durationMs = Date.now() - matchState.startTime;

        // Stop music immediately on match conclusion
        audioEngine.stopMusic();

        const winner = playerHealth.current > 0 ? 'player' : 'ai';

        // ── RL: end-of-match update + persist ─────────────────────────────
        if (rlDifficulty) {
          const isFlawless  = winner === 'ai' && playerHealth.current === playerHealth.max;
          const matchReward = rewardCalc.computeMatchReward(winner, isFlawless);
          rlAgent.onMatchEnd(matchReward);
          // Persist locally
          saveManager.saveQTable(rlAgent.serialize());
          // Upload delta to global server (fire-and-forget)
          const delta = rlAgent.drainDelta();
          RLSyncService.contributeQTable(delta, 1);
          updateRLStatsPanel(rlAgent.getStats(), true);
        }

        // End-game achievements
        if (winner === 'player') {
          // Flawless
          if (playerHealth.current === playerHealth.max) {
            saveManager.unlockAchievement('flawless');
          }
          // Giant Slayer
          const aiController = world.getComponent(ai, ComponentTypes.AI_CONTROLLER);
          if (aiController && aiController.difficulty === 'nightmare') {
            saveManager.unlockAchievement('giantSlayer');
          }
        }

        // Display results overlay after a small cinematic delay (1.2 seconds)
        setTimeout(() => {
          if (matchState.active) {
            uiManager.showResults(winner, matchState.stats);
          }
        }, 1200);
      }
    }
  };

  const render = (alpha) => {
    if (!matchState.active) return;
    renderSyncSystem(world, alpha, layers);
  };

  // 6. Start the GameLoop
  const gameLoop = new GameLoop({ update, render });
  gameLoop.start();

  // Hide loader bar
  setTimeout(() => {
    const loaderBar = document.getElementById('loader-bar-fill');
    const loaderText = document.getElementById('loader-text');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (loaderBar) loaderBar.style.width = '100%';
    if (loaderText) loaderText.textContent = 'Ready!';

    setTimeout(() => {
      if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 500);
      }
    }, 200);
  }, 500);
});
