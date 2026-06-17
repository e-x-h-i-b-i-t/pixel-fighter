import { ComponentTypes } from '../../ecs/componentTypes.js';

/**
 * ECS System to decay combo timers and reset combo chains on expiry.
 * Runs in Step 10 of the execution cycle.
 * @param {World} world 
 */
export function comboTrackingSystem(world) {
  const entities = world.query([ComponentTypes.COMBO_STATE]);

  for (const entityId of entities) {
    const combo = world.getComponent(entityId, ComponentTypes.COMBO_STATE);
    
    if (combo && combo.comboTimer > 0) {
      combo.comboTimer--;
      
      if (combo.comboTimer <= 0) {
        combo.chainIndex = 0;
        combo.comboDamageScalar = 1.0;
        combo.lastMoveId = null;
      }
    }
  }
}
