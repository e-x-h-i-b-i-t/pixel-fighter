import Matter from 'matter-js';
import { ComponentTypes } from '../../ecs/componentTypes.js';

/**
 * ECS System governing hit detection between Hitboxes and Hurtboxes.
 * Runs in Step 8 of the execution cycle.
 * @param {World} world 
 * @param {MatterWorld} physicsWorld 
 */
export function hitDetectionSystem(world, physicsWorld) {
  const hitboxEntities = world.query([
    ComponentTypes.HITBOX_SHAPE,
    ComponentTypes.PHYSICS_BODY,
    ComponentTypes.OWNER_REF,
    ComponentTypes.DAMAGE_PACKET
  ]);

  const hurtboxEntities = world.query([
    ComponentTypes.HURTBOX,
    ComponentTypes.PHYSICS_BODY,
    ComponentTypes.HEALTH
  ]);

  for (const hitboxId of hitboxEntities) {
    const hitboxShape = world.getComponent(hitboxId, ComponentTypes.HITBOX_SHAPE);
    const hitboxPhys = world.getComponent(hitboxId, ComponentTypes.PHYSICS_BODY);
    const ownerRef = world.getComponent(hitboxId, ComponentTypes.OWNER_REF);
    const damagePacket = world.getComponent(hitboxId, ComponentTypes.DAMAGE_PACKET);

    if (!hitboxShape || !hitboxPhys || !ownerRef || !damagePacket) continue;

    // Find the Matter body of the hitbox
    const hitboxBody = physicsWorld.world.bodies.find(b => b.id === hitboxPhys.matterBodyId);
    if (!hitboxBody) continue;

    for (const hurtboxId of hurtboxEntities) {
      // Avoid hitting yourself
      if (hurtboxId === ownerRef.entityId) continue;

      // Avoid hitting the same target multiple times with the same hitbox
      if (hitboxShape.alreadyHitEntityIds.has(hurtboxId)) continue;

      const hurtboxComp = world.getComponent(hurtboxId, ComponentTypes.HURTBOX);
      const hurtboxPhys = world.getComponent(hurtboxId, ComponentTypes.PHYSICS_BODY);
      const health = world.getComponent(hurtboxId, ComponentTypes.HEALTH);

      if (!hurtboxComp || !hurtboxPhys || !health) continue;

      // Skip dead or invulnerable entities
      if (health.current <= 0 || health.isInvulnerable) continue;

      // Find the Matter body of the hurtbox
      const hurtboxBody = physicsWorld.world.bodies.find(b => b.id === hurtboxPhys.matterBodyId);
      if (!hurtboxBody) continue;

      // Run Matter.js overlap query between hitbox body and hurtbox body
      const collisions = Matter.Query.collides(hitboxBody, [hurtboxBody]);
      if (collisions.length > 0) {
        // Successful hit!
        hitboxShape.alreadyHitEntityIds.add(hurtboxId);

        // Queue incoming hit packet on the defender's Health component
        health.incomingHits = health.incomingHits || [];
        health.incomingHits.push({
          attackerId: ownerRef.entityId,
          baseDamage: damagePacket.baseDamage,
          damageType: damagePacket.damageType,
          element: damagePacket.element,
          baseKnockback: damagePacket.baseKnockback,
          moveLaunchAngle: damagePacket.moveLaunchAngle,
          hitstunFrames: damagePacket.hitstunFrames,
          canCrit: damagePacket.canCrit,
          isCounterOrParryPunish: damagePacket.isCounterOrParryPunish
        });
      }
    }
  }
}
