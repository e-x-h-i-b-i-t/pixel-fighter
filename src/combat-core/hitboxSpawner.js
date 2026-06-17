import Matter from 'matter-js';
import { ComponentTypes } from '../ecs/componentTypes.js';
import { CollisionCategories } from '../physics/MatterWorld.js';

/**
 * Spawns a Hitbox entity in the ECS world with a corresponding Matter.js sensor body.
 * @param {World} world - ECS World
 * @param {number} ownerId - Entity ID of the attacker spawning this hitbox
 * @param {MatterWorld} physicsWorld - MatterWorld wrapper
 * @param {Object} options
 * @param {Object} options.offset - { x, y } offset relative to owner position
 * @param {Object} options.size - { width, height } of the hitbox rectangle
 * @param {number} options.lifetimeFrames - Duration in simulation ticks before despawning
 * @param {Object} options.damagePacket - Damage, element, knockback angles and forces
 * @returns {number} The spawned hitbox entity ID
 */
export function spawnHitbox(world, ownerId, physicsWorld, options) {
  const ownerTransform = world.getComponent(ownerId, ComponentTypes.TRANSFORM);
  if (!ownerTransform) return null;

  const facing = ownerTransform.facing || 1;
  
  // Calculate absolute coordinates based on owner position and facing
  const absX = ownerTransform.x + (options.offset.x * facing);
  const absY = ownerTransform.y + options.offset.y;

  // 1. Create Matter.js sensor body
  const body = Matter.Bodies.rectangle(absX, absY, options.size.width, options.size.height, {
    isSensor: true,
    isStatic: false, // Kinematic/dynamic is fine, we manually position it
    collisionFilter: {
      category: CollisionCategories.HITBOX,
      mask: CollisionCategories.HURTBOX // Hitboxes only interact with Hurtboxes
    },
    label: 'hitbox'
  });

  // 2. Create ECS entity
  const hitboxEntityId = world.createEntity();
  
  // 3. Register body
  physicsWorld.registerBody(body, hitboxEntityId);

  // 4. Add ECS Components
  world.addComponent(hitboxEntityId, ComponentTypes.TRANSFORM, {
    x: absX,
    y: absY,
    facing: facing
  });

  world.addComponent(hitboxEntityId, ComponentTypes.PHYSICS_BODY, {
    matterBodyId: body.id,
    bodyType: 'kinematic',
    collisionGroup: CollisionCategories.HITBOX
  });

  world.addComponent(hitboxEntityId, ComponentTypes.OWNER_REF, {
    entityId: ownerId
  });

  world.addComponent(hitboxEntityId, ComponentTypes.HITBOX_SHAPE, {
    shape: 'box',
    offset: { x: options.offset.x, y: options.offset.y },
    size: { width: options.size.width, height: options.size.height },
    alreadyHitEntityIds: new Set() // Set of entities already struck by this hitbox
  });

  world.addComponent(hitboxEntityId, ComponentTypes.DAMAGE_PACKET, {
    baseDamage: options.damagePacket.baseDamage !== undefined ? options.damagePacket.baseDamage : 10,
    damageType: options.damagePacket.damageType || 'physical',
    element: options.damagePacket.element || 'neutral',
    knockbackVector: options.damagePacket.knockbackVector || { x: 0, y: 0 },
    hitstunFrames: options.damagePacket.hitstunFrames !== undefined ? options.damagePacket.hitstunFrames : 15,
    canCrit: options.damagePacket.canCrit !== undefined ? options.damagePacket.canCrit : true,
    baseKnockback: options.damagePacket.baseKnockback !== undefined ? options.damagePacket.baseKnockback : 5,
    moveLaunchAngle: options.damagePacket.moveLaunchAngle !== undefined ? options.damagePacket.moveLaunchAngle : 45,
    isCounterOrParryPunish: options.damagePacket.isCounterOrParryPunish || false
  });

  world.addComponent(hitboxEntityId, ComponentTypes.LIFETIME, {
    remainingFrames: options.lifetimeFrames,
    onExpire: () => {
      // Cleanup Matter body
      physicsWorld.unregisterBody(body);
      // Destroy entity
      world.destroyEntity(hitboxEntityId);
    }
  });

  return hitboxEntityId;
}
