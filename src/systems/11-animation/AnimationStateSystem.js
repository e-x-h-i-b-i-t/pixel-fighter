import { ComponentTypes } from '../../ecs/componentTypes.js';

const DEFAULT_FRAME_DURATION = 8; // ticks per frame (8 * 16.67ms = 133ms per frame)

const ONE_SHOT_CLIPS = ['attack', 'hit', 'dead'];

/**
 * ECS System to manage entity animation state machines.
 * Runs in Step 16 of the execution cycle.
 * @param {World} world 
 */
export function animationStateSystem(world) {
  const entities = world.query([ComponentTypes.ANIMATION_STATE, ComponentTypes.TRANSFORM, ComponentTypes.VELOCITY]);

  for (const entityId of entities) {
    const anim = world.getComponent(entityId, ComponentTypes.ANIMATION_STATE);
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);
    const velocity = world.getComponent(entityId, ComponentTypes.VELOCITY);
    const health = world.getComponent(entityId, ComponentTypes.HEALTH);

    if (!anim || !transform || !velocity) continue;

    // 1. Determine Target Clip based on entity state
    let targetClip = anim.currentClip || 'idle';
    
    const isDead = health && health.current <= 0;
    const isHitstun = transform.hitstunFramesLeft > 0;
    
    // Override clip if in special states
    if (isDead) {
      targetClip = 'dead';
    } else if (isHitstun) {
      targetClip = 'hit';
    } else if (anim.currentClip === 'attack') {
      // Attacks are one-shots, lock them until they finish playing
      targetClip = 'attack';
    } else {
      // Standard locomotion state mapping
      if (transform.isAirborne) {
        if (velocity.vy < 0) {
          targetClip = 'jump';
        } else {
          targetClip = 'fall';
        }
      } else {
        if (Math.abs(velocity.vx) > 0.5) {
          // Sprinting threshold
          const isSprinting = Math.abs(velocity.vx) > 2.6;
          targetClip = isSprinting ? 'run' : 'walk';
        } else {
          targetClip = 'idle';
        }
      }
    }

    // If clip changed, reset frame trackers
    if (targetClip !== anim.currentClip) {
      anim.currentClip = targetClip;
      anim.frameIndex = 0;
      anim.frameTimer = 0;
    }

    // 2. Advance Frame Animation Ticker
    const frameDuration = anim.frameDurationTicks || DEFAULT_FRAME_DURATION;
    anim.frameTimer++;

    if (anim.frameTimer >= frameDuration) {
      anim.frameTimer = 0;
      anim.frameIndex++;
      
      const totalFrames = 4; // Our procedural sprite sheets always have 4 frames
      const isOneShot = ONE_SHOT_CLIPS.includes(anim.currentClip);

      if (anim.frameIndex >= totalFrames) {
        if (isOneShot) {
          if (anim.currentClip === 'dead') {
            // Dead stays on last frame
            anim.frameIndex = totalFrames - 1;
          } else {
            // Transition back to idle
            anim.currentClip = anim.queuedClip || 'idle';
            anim.queuedClip = null;
            anim.frameIndex = 0;
          }
        } else {
          // Loop
          anim.frameIndex = 0;
        }
      }
    }
  }
}
