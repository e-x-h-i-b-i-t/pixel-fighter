import { ComponentTypes } from '../../ecs/componentTypes.js';
import { spawnHitbox } from '../../combat-core/hitboxSpawner.js';
import { audioEngine } from '../../core/AudioEngine.js';

/**
 * ECS System to convert input actions into combat moves, dashes, rolls, and jumps.
 * Runs in Step 3 of the execution cycle.
 * @param {World} world 
 * @param {MatterWorld} physicsWorld 
 */
export function actionResolutionSystem(world, physicsWorld) {
  const entities = world.query([
    ComponentTypes.TRANSFORM,
    ComponentTypes.VELOCITY,
    ComponentTypes.ANIMATION_STATE,
    ComponentTypes.HEALTH
  ]);

  for (const entityId of entities) {
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);
    const velocity = world.getComponent(entityId, ComponentTypes.VELOCITY);
    const anim = world.getComponent(entityId, ComponentTypes.ANIMATION_STATE);
    const health = world.getComponent(entityId, ComponentTypes.HEALTH);
    const stamina = world.getComponent(entityId, ComponentTypes.STAMINA);
    const mana = world.getComponent(entityId, ComponentTypes.MANA);
    const ultimate = world.getComponent(entityId, ComponentTypes.ULTIMATE_METER);
    const input = world.getComponent(entityId, ComponentTypes.INPUT_CONTROLLER);
    
    if (health.current <= 0) continue;

    // 1. Update Invulnerability during active dash/roll
    health.isInvulnerable = transform.isDashing || transform.isRolling;

    // 2. Regen stamina and mana over time
    if (stamina && stamina.current < stamina.max) {
      stamina.current = Math.min(stamina.max, stamina.current + (stamina.regenRate || 0.2));
    }
    if (mana && mana.current < mana.max) {
      mana.current = Math.min(mana.max, mana.current + (mana.regenRate || 0.05));
    }

    // 3. Handle ongoing frame triggers (spawning hitboxes during active attack clips)
    if (anim.currentClip === 'attack') {
      // Spawn hitbox on frame index 1 (the visual mid-swing frame)
      if (anim.frameIndex === 1 && !anim.attackHitboxSpawned) {
        anim.attackHitboxSpawned = true;
        
        // Spawn hitbox based on character class
        const charClass = transform.characterClass || 'knight';
        let hitboxOpts = null;

        if (charClass === 'knight') {
          if (anim.attackType === 'light') {
            hitboxOpts = {
              offset: { x: 28, y: -10 },
              size: { width: 35, height: 35 },
              lifetimeFrames: 5,
              damagePacket: { baseDamage: 12, baseKnockback: 4.5, moveLaunchAngle: 25 }
            };
          } else if (anim.attackType === 'heavy') {
            hitboxOpts = {
              offset: { x: 32, y: -10 },
              size: { width: 45, height: 40 },
              lifetimeFrames: 6,
              damagePacket: { baseDamage: 24, baseKnockback: 7.0, moveLaunchAngle: 45 }
            };
          } else if (anim.attackType === 'ultimate') {
            hitboxOpts = {
              offset: { x: 40, y: -15 },
              size: { width: 80, height: 65 },
              lifetimeFrames: 8,
              damagePacket: { baseDamage: 45, baseKnockback: 9.5, moveLaunchAngle: 55 }
            };
          }
        } else if (charClass === 'samurai') {
          if (anim.attackType === 'light') {
            hitboxOpts = {
              offset: { x: 32, y: -5 },
              size: { width: 45, height: 25 },
              lifetimeFrames: 4,
              damagePacket: { baseDamage: 10, baseKnockback: 3.5, moveLaunchAngle: 15 }
            };
          } else if (anim.attackType === 'heavy') {
            hitboxOpts = {
              offset: { x: 36, y: -10 },
              size: { width: 55, height: 30 },
              lifetimeFrames: 5,
              damagePacket: { baseDamage: 20, baseKnockback: 6.0, moveLaunchAngle: 30 }
            };
          } else if (anim.attackType === 'ultimate') {
            hitboxOpts = {
              offset: { x: 50, y: -10 },
              size: { width: 100, height: 40 },
              lifetimeFrames: 6,
              damagePacket: { baseDamage: 40, baseKnockback: 8.5, moveLaunchAngle: 10 }
            };
          }
        } else if (charClass === 'assassin') {
          if (anim.attackType === 'light') {
            hitboxOpts = {
              offset: { x: 20, y: -5 },
              size: { width: 28, height: 25 },
              lifetimeFrames: 3,
              damagePacket: { baseDamage: 8, baseKnockback: 2.0, moveLaunchAngle: 10 }
            };
          } else if (anim.attackType === 'heavy') {
            hitboxOpts = {
              offset: { x: 24, y: -5 },
              size: { width: 35, height: 25 },
              lifetimeFrames: 4,
              damagePacket: { baseDamage: 16, baseKnockback: 4.5, moveLaunchAngle: 20 }
            };
          } else if (anim.attackType === 'ultimate') {
            hitboxOpts = {
              offset: { x: 30, y: -5 },
              size: { width: 60, height: 30 },
              lifetimeFrames: 6,
              damagePacket: { baseDamage: 36, baseKnockback: 6.5, moveLaunchAngle: 45 }
            };
          }
        } else if (charClass === 'mage') {
          if (anim.attackType === 'light') {
            hitboxOpts = {
              offset: { x: 35, y: -15 },
              size: { width: 30, height: 30 },
              lifetimeFrames: 6,
              damagePacket: { baseDamage: 9, baseKnockback: 2.5, moveLaunchAngle: 20 }
            };
          } else if (anim.attackType === 'heavy') {
            hitboxOpts = {
              offset: { x: 45, y: -15 },
              size: { width: 40, height: 40 },
              lifetimeFrames: 7,
              damagePacket: { baseDamage: 18, baseKnockback: 5.0, moveLaunchAngle: 35 }
            };
          } else if (anim.attackType === 'ultimate') {
            hitboxOpts = {
              offset: { x: 60, y: -20 },
              size: { width: 90, height: 90 },
              lifetimeFrames: 10,
              damagePacket: { baseDamage: 38, baseKnockback: 8.0, moveLaunchAngle: 45 }
            };
          }
        }

        if (hitboxOpts) {
          spawnHitbox(world, entityId, physicsWorld, hitboxOpts);
        }
      }
    }

    // 4. Read buffered inputs (if controlled by real or virtual controller)
    let nextAction = null;
    
    // Check real player controller buffer
    if (input && input.bufferedInputs.length > 0) {
      // Find the first unconsumed action
      const item = input.bufferedInputs.find(i => !i.consumed);
      if (item) {
        nextAction = item.action;
        item.consumed = true;
      }
    }

    // Check virtual AI action buffer
    if (transform.aiBufferedAction) {
      nextAction = transform.aiBufferedAction;
      transform.aiBufferedAction = null;
    }

    if (!nextAction) continue;

    // Check action states and cancel windows
    const isAttacking = anim.currentClip === 'attack';
    const isHitstun = transform.hitstunFramesLeft > 0;
    const isRolling = transform.isRolling;
    const isDashing = transform.isDashing;

    // Can only perform actions if not stunned or rolling/dashing
    if (isHitstun || isRolling || isDashing) continue;

    if (nextAction === 'jump') {
      transform.wantsToJump = true;
    } else if (nextAction === 'dash') {
      if (stamina && stamina.current >= 20) {
        stamina.current -= 20;
        transform.isDashing = true;
        transform.dashTicks = 0;
        anim.currentClip = 'run'; // Trigger dash visual
        audioEngine.playSFX('dash', transform.x);
      }
    } else if (nextAction === 'roll') {
      if (stamina && stamina.current >= 25) {
        stamina.current -= 25;
        transform.isRolling = true;
        transform.rollTicks = 0;
        anim.currentClip = 'walk'; // Trigger roll visual
        audioEngine.playSFX('swing', transform.x);
      }
    } else if (nextAction === 'lightAttack') {
      if (!isAttacking && (!stamina || stamina.current >= 15)) {
        if (stamina) stamina.current -= 15;
        anim.currentClip = 'attack';
        anim.attackType = 'light';
        anim.attackHitboxSpawned = false;
        anim.frameIndex = 0;
        anim.frameTimer = 0;
        audioEngine.playSFX('swing', transform.x);
      }
    } else if (nextAction === 'heavyAttack') {
      if (!isAttacking && (!stamina || stamina.current >= 30)) {
        if (stamina) stamina.current -= 30;
        anim.currentClip = 'attack';
        anim.attackType = 'heavy';
        anim.attackHitboxSpawned = false;
        anim.frameIndex = 0;
        anim.frameTimer = 0;
        audioEngine.playSFX('swing', transform.x);
      }
    } else if (nextAction === 'ultimate') {
      if (!isAttacking && ultimate && ultimate.isReady) {
        ultimate.current = 0;
        ultimate.isReady = false;
        anim.currentClip = 'attack';
        anim.attackType = 'ultimate';
        anim.attackHitboxSpawned = false;
        anim.frameIndex = 0;
        anim.frameTimer = 0;
        audioEngine.playSFX('ultimate', transform.x);
      }
    }
  }
}
