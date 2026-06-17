import Matter from 'matter-js';
import { ComponentTypes } from '../../ecs/componentTypes.js';

/**
 * ECS System to synchronize Matter.js body positions with ECS Transform positions.
 * Runs in Step 5 of the execution loop (after movement and before combat queries).
 * @param {World} world 
 * @param {MatterWorld} physicsWorld 
 */
export function physicsPostUpdateSystem(world, physicsWorld) {
  const entities = world.query([ComponentTypes.TRANSFORM, ComponentTypes.PHYSICS_BODY]);

  for (const entityId of entities) {
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);
    const physBodyComp = world.getComponent(entityId, ComponentTypes.PHYSICS_BODY);
    
    if (!physBodyComp || !physBodyComp.matterBodyId) continue;

    // Find the body in Matter world
    const body = physicsWorld.world.bodies.find(b => b.id === physBodyComp.matterBodyId);
    if (body) {
      // Synchronize position
      Matter.Body.setPosition(body, { x: transform.x, y: transform.y });
    }
  }
}
