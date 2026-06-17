import Matter from 'matter-js';
import { ComponentTypes } from '../ecs/componentTypes.js';

// Gravity and movement constants (tuned for 60Hz/16.67ms tick)
export const MovementConstants = {
  GRAVITY: 0.25,          // standard downward acceleration per tick
  FAST_FALL_GRAVITY: 0.4, // higher gravity when pressing down or falling fast
  TERMINAL_VELOCITY: 8.0, // max downward speed
  WALK_ACCEL: 0.3,
  WALK_DECEL: 0.4,
  RUN_ACCEL: 0.4,
  RUN_DECEL: 0.4,
  JUMP_FORCE: -6.0,
  DOUBLE_JUMP_FORCE: -5.0,
  DASH_SPEED: 7.0,
  DASH_DURATION_TICKS: 5,
  ROLL_SPEED: 4.5,
  ROLL_DURATION_TICKS: 8
};

/**
 * Resolves platformer movement and AABB static collisions for a single entity.
 * @param {World} world - ECS World
 * @param {number} entityId - Entity ID
 * @param {MatterWorld} physicsWorld - MatterWorld wrapper
 * @param {number} dtMs - Timestep in milliseconds (16.67ms)
 */
export function resolvePlatformerMovement(world, entityId, physicsWorld, dtMs) {
  const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);
  const velocity = world.getComponent(entityId, ComponentTypes.VELOCITY);
  const health = world.getComponent(entityId, ComponentTypes.HEALTH);
  
  if (!transform || !velocity) return;

  // If dead, movement is not resolved here (it's handled by ragdoll physics)
  if (health && health.current <= 0) return;

  // Bounding box size for collision resolution (default: width=20, height=48)
  const width = 20;
  const height = 48;

  // Grab all static bodies from Matter world to collide against
  const staticBodies = Matter.Composite.allBodies(physicsWorld.world)
    .filter(body => body.isStatic);

  // --- Apply Gravity ---
  // Gravity applies unless in active dash/roll movement state
  const isDashing = transform.isDashing || false;
  const isRolling = transform.isRolling || false;

  if (!isDashing && !isRolling) {
    const activeGravity = velocity.vy > 0 ? MovementConstants.FAST_FALL_GRAVITY : MovementConstants.GRAVITY;
    velocity.vy += activeGravity;
    if (velocity.vy > MovementConstants.TERMINAL_VELOCITY) {
      velocity.vy = MovementConstants.TERMINAL_VELOCITY;
    }
  }

  // --- State Updates: Dash & Roll ---
  if (isDashing) {
    transform.dashTicks = (transform.dashTicks || 0) + 1;
    velocity.vx = MovementConstants.DASH_SPEED * transform.facing;
    velocity.vy = 0; // Ignore gravity during dash
    
    if (transform.dashTicks >= MovementConstants.DASH_DURATION_TICKS) {
      transform.isDashing = false;
      transform.dashTicks = 0;
      velocity.vx = 0;
    }
  } else if (isRolling) {
    transform.rollTicks = (transform.rollTicks || 0) + 1;
    velocity.vx = MovementConstants.ROLL_SPEED * transform.facing;
    velocity.vy = 0; // Ignore gravity during roll
    
    if (transform.rollTicks >= MovementConstants.ROLL_DURATION_TICKS) {
      transform.isRolling = false;
      transform.rollTicks = 0;
      velocity.vx = 0;
    }
  }

  // --- Horizontal Collision Resolution ---
  // Move horizontally first
  transform.x += velocity.vx;

  // Resolve horizontal collisions
  let entityBox = getEntityBox(transform.x, transform.y, width, height);
  for (const body of staticBodies) {
    if (checkAABBOverlap(entityBox, body.bounds)) {
      // Collision detected. Push out horizontally.
      const overlapX = getOverlapX(entityBox, body.bounds);
      if (overlapX !== 0) {
        transform.x += overlapX;
        velocity.vx = 0;
        entityBox = getEntityBox(transform.x, transform.y, width, height); // update box
      }
    }
  }

  // --- Vertical Collision Resolution ---
  // Move vertically second
  transform.y += velocity.vy;

  // Resolve vertical collisions and ground check
  let isGrounded = false;
  entityBox = getEntityBox(transform.x, transform.y, width, height);
  for (const body of staticBodies) {
    if (checkAABBOverlap(entityBox, body.bounds)) {
      // Collision detected. Push out vertically.
      const overlapY = getOverlapY(entityBox, body.bounds);
      if (overlapY !== 0) {
        transform.y += overlapY;
        
        // If we were moving downwards (or stationary) and got pushed up, we hit the ground
        if (velocity.vy >= 0 && overlapY < 0) {
          isGrounded = true;
        }
        
        velocity.vy = 0;
        entityBox = getEntityBox(transform.x, transform.y, width, height); // update box
      }
    }
  }

  // Reset jump/dash counters if grounded
  if (isGrounded) {
    transform.doubleJumpsLeft = 1;
    transform.isAirborne = false;
  } else {
    transform.isAirborne = true;
  }
}

// Helpers for AABB Overlap checks

function getEntityBox(x, y, width, height) {
  // x is bottom-center, y is bottom-center
  return {
    min: { x: x - width / 2, y: y - height },
    max: { x: x + width / 2, y: y }
  };
}

function checkAABBOverlap(boxA, boxB) {
  return (
    boxA.min.x < boxB.max.x &&
    boxA.max.x > boxB.min.x &&
    boxA.min.y < boxB.max.y &&
    boxA.max.y > boxB.min.y
  );
}

function getOverlapX(boxA, boxB) {
  // Calculate left and right overlaps
  const overlapLeft = boxB.max.x - boxA.min.x;
  const overlapRight = boxB.min.x - boxA.max.x;
  
  // Return the smaller shift needed to resolve collision
  if (Math.abs(overlapLeft) < Math.abs(overlapRight)) {
    return overlapLeft;
  } else {
    return overlapRight;
  }
}

function getOverlapY(boxA, boxB) {
  // Calculate top and bottom overlaps
  const overlapTop = boxB.max.y - boxA.min.y;
  const overlapBottom = boxB.min.y - boxA.max.y;
  
  if (Math.abs(overlapTop) < Math.abs(overlapBottom)) {
    return overlapTop;
  } else {
    return overlapBottom;
  }
}
