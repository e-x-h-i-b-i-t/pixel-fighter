import { ComponentTypes } from '../../ecs/componentTypes.js';

/**
 * ECS System to decay the LIFETIME of entities (like active hitboxes or temporary VFX)
 * and trigger their expiration cleanup callbacks.
 * @param {World} world 
 */
export function lifetimeSystem(world) {
  const entities = world.query([ComponentTypes.LIFETIME]);

  for (const entityId of entities) {
    const lifetime = world.getComponent(entityId, ComponentTypes.LIFETIME);
    if (!lifetime) continue;

    lifetime.remainingFrames--;
    if (lifetime.remainingFrames <= 0) {
      if (typeof lifetime.onExpire === 'function') {
        lifetime.onExpire();
      }
    }
  }
}
