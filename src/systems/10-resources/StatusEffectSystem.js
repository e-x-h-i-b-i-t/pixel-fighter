import { ComponentTypes } from '../../ecs/componentTypes.js';

/**
 * ECS System to update status effects (burn, freeze, shock) on entities.
 * Runs in Step 10 of the execution cycle.
 * @param {World} world 
 */
export function statusEffectSystem(world) {
  const entities = world.query([ComponentTypes.STATUS_EFFECTS, ComponentTypes.HEALTH]);

  for (const entityId of entities) {
    const statusComp = world.getComponent(entityId, ComponentTypes.STATUS_EFFECTS);
    const health = world.getComponent(entityId, ComponentTypes.HEALTH);
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);

    if (!statusComp || !health) continue;

    let speedMod = 1.0;
    let isFrozen = false;

    // Filter and update active effects
    statusComp.active = statusComp.active.filter(effect => {
      // Decrement remaining duration timer (in frames/ticks)
      effect.timer--;

      if (effect.timer <= 0) {
        // Effect expired
        return false;
      }

      // Process effect ticks
      if (effect.type === 'burn') {
        // Burn deals tick damage every 30 frames (0.5s)
        effect.tickTimer = (effect.tickTimer || 0) + 1;
        if (effect.tickTimer >= 30) {
          effect.tickTimer = 0;
          health.current = Math.max(0, health.current - (effect.value || 1));
          health.lastHitTimestamp = Date.now();
        }
      } else if (effect.type === 'freeze') {
        // Freeze reduces wielder move speed
        speedMod = Math.min(speedMod, effect.value !== undefined ? effect.value : 0.5);
        isFrozen = true;
      }

      return true;
    });

    // Sync speed modifier back to wielder transform
    if (transform) {
      transform.speedModifier = speedMod;
    }
  }
}
