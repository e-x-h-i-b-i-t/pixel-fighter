import { ComponentTypes } from '../../ecs/componentTypes.js';
import { encodeState } from '../../ai/StateEncoder.js';

/**
 * ECS System to run AI decision making and buffer virtual inputs.
 * Runs in Step 2 of the execution cycle.
 * @param {World} world
 * @param {import('../../ai/RLAgent.js').RLAgent|null} [rlAgent] - Optional RL agent (used when difficulty === 'adaptive')
 */
export function aiSystem(world, rlAgent = null) {
  const aiEntities = world.query([ComponentTypes.AI_CONTROLLER, ComponentTypes.TRANSFORM]);
  const playerEntities = world.query([ComponentTypes.INPUT_CONTROLLER, ComponentTypes.TRANSFORM]);

  if (aiEntities.length === 0) return;

  // Find the primary player target
  const playerEntityId = playerEntities.length > 0 ? playerEntities[0] : null;

  for (const aiId of aiEntities) {
    const ai = world.getComponent(aiId, ComponentTypes.AI_CONTROLLER);
    const transform = world.getComponent(aiId, ComponentTypes.TRANSFORM);
    const health = world.getComponent(aiId, ComponentTypes.HEALTH);
    
    // Skip if AI is dead
    if (health && health.current <= 0) {
      transform.aiMoveDir = 0;
      transform.aiIsRunning = false;
      continue;
    }

    // ── Adaptive (RL) path ────────────────────────────────────────────────
    if (ai.difficulty === 'adaptive' && rlAgent && playerEntityId !== null) {
      const stateKey = encodeState(world, aiId, playerEntityId);
      if (stateKey) {
        const action = rlAgent.chooseAction(stateKey);
        _applyRLAction(transform, action);
        rlAgent.lastState  = stateKey;
        rlAgent.lastAction = action;
        continue; // Skip rule-based logic
      }
    }

    // Assign target (default to primary player, fallback to any other character)
    ai.targetEntityId = playerEntityId;
    if (!ai.targetEntityId) {
      const others = world.query([ComponentTypes.HEALTH, ComponentTypes.TRANSFORM]);
      const other = others.find(id => id !== aiId);
      if (other) {
        ai.targetEntityId = other;
      }
    }

    if (!ai.targetEntityId) {
      transform.aiMoveDir = 0;
      transform.aiIsRunning = false;
      continue;
    }

    const playerTransform = world.getComponent(ai.targetEntityId, ComponentTypes.TRANSFORM);
    const playerAnim = world.getComponent(ai.targetEntityId, ComponentTypes.ANIMATION_STATE);
    const playerHealth = world.getComponent(ai.targetEntityId, ComponentTypes.HEALTH);
    
    if (!playerTransform || (playerHealth && playerHealth.current <= 0)) {
      // Idle if player is missing or dead
      transform.aiMoveDir = 0;
      transform.aiIsRunning = false;
      continue;
    }

    // 0. Dynamic difficulty adjustment (adaptive model)
    if (playerHealth && health) {
      const aiHpPct = health.current / health.max;
      const playerHpPct = playerHealth.current / playerHealth.max;
      
      if (!ai.originalDifficulty) {
        ai.originalDifficulty = ai.difficulty;
      }
      
      if (aiHpPct < 0.4 && playerHpPct > 0.7) {
        // AI is losing badly, increase difficulty
        if (ai.originalDifficulty === 'easy') ai.difficulty = 'medium';
        else if (ai.originalDifficulty === 'medium') ai.difficulty = 'hard';
        else if (ai.originalDifficulty === 'hard') ai.difficulty = 'nightmare';
      } else if (playerHpPct < 0.3 && aiHpPct > 0.7) {
        // Player is losing badly, decrease difficulty
        if (ai.originalDifficulty === 'medium') ai.difficulty = 'easy';
        else if (ai.originalDifficulty === 'hard') ai.difficulty = 'medium';
        else if (ai.originalDifficulty === 'nightmare') ai.difficulty = 'hard';
      } else {
        ai.difficulty = ai.originalDifficulty;
      }
    }

    // 1. Tick reaction timer
    if (ai.reactionTimer > 0) {
      ai.reactionTimer--;
      continue;
    }

    // 2. Set reaction timer based on difficulty profile
    let baseReaction = 15;
    if (ai.difficulty === 'easy') baseReaction = 25;
    else if (ai.difficulty === 'hard') baseReaction = 8;
    else if (ai.difficulty === 'nightmare') baseReaction = 1; // extremely fast reactions
    ai.reactionTimer = baseReaction;

    // 3. Evaluate distances
    const dx = playerTransform.x - transform.x;
    const dy = playerTransform.y - transform.y;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx);

    // 4. Defensive check: is the player currently mid-attack?
    const isPlayerAttacking = playerAnim && playerAnim.currentClip === 'attack';
    if (isPlayerAttacking && dist < 60) {
      let defendRoll = Math.random() * 100;
      let defendChance = 10; // Easy

      if (ai.difficulty === 'medium') defendChance = 30;
      else if (ai.difficulty === 'hard') defendChance = 55;
      else if (ai.difficulty === 'nightmare') defendChance = 85;

      if (defendRoll < defendChance) {
        // Dodge roll or jump back
        const rng = Math.random();
        if (rng < 0.4) {
          transform.aiBufferedAction = 'roll';
        } else if (rng < 0.7) {
          transform.aiBufferedAction = 'jump';
          transform.aiMoveDir = -dir; // jump away
        } else {
          transform.aiBufferedAction = 'parry';
        }
        continue;
      }
    }

    // 5. Offensive decision making
    if (dist < 45) {
      // Close Range: swing!
      transform.aiMoveDir = 0; // stop moving
      transform.facing = dir;  // face target

      const attackRoll = Math.random() * 100;
      const ultimate = world.getComponent(aiId, ComponentTypes.ULTIMATE_METER);

      if (ultimate && ultimate.isReady) {
        transform.aiBufferedAction = 'ultimate';
      } else if (ai.difficulty === 'easy') {
        if (attackRoll < 35) transform.aiBufferedAction = 'lightAttack';
      } else {
        if (attackRoll < 45) {
          transform.aiBufferedAction = 'lightAttack';
        } else if (attackRoll < 75) {
          transform.aiBufferedAction = 'heavyAttack';
        }
      }
    } else {
      // Mid-Far range: pursue player
      transform.aiMoveDir = dir;
      transform.aiIsRunning = (ai.difficulty !== 'easy' && dist > 70);

      // Random jump to clear obstacles or chase player if player is higher
      if (dy < -40 && Math.random() < 0.15) {
        transform.aiBufferedAction = 'jump';
      }
    }
  }
}

// ── RL Helper ─────────────────────────────────────────────────────────────────

/**
 * Maps an RL action string to the same transform flags used by the rule-based AI.
 * @param {Object} transform - ECS Transform component
 * @param {string} action    - One of RL_ACTIONS
 */
function _applyRLAction(transform, action) {
  // Reset movement direction first
  transform.aiMoveDir    = 0;
  transform.aiIsRunning  = false;
  transform.aiBufferedAction = null;

  switch (action) {
    case 'move_toward':
      transform.aiMoveDir   = 1;  // will be corrected to face player by caller context
      transform.aiIsRunning = true;
      break;
    case 'move_away':
      transform.aiMoveDir   = -1;
      transform.aiIsRunning = false;
      break;
    case 'idle':
      // stay still — defaults above are correct
      break;
    case 'jump':
      transform.aiBufferedAction = 'jump';
      break;
    case 'light_attack':
      transform.aiBufferedAction = 'lightAttack';
      break;
    case 'heavy_attack':
      transform.aiBufferedAction = 'heavyAttack';
      break;
    case 'parry':
      transform.aiBufferedAction = 'parry';
      break;
    case 'dash':
      transform.aiBufferedAction = 'dash';
      break;
    case 'roll':
      transform.aiBufferedAction = 'roll';
      break;
    default:
      break;
  }
}

