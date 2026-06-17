import { ComponentTypes } from '../../ecs/componentTypes.js';
import { resolvePlatformerMovement, MovementConstants } from '../../physics/platformerMovement.js';
import { audioEngine } from '../../core/AudioEngine.js';

/**
 * ECS System governing entity movement, acceleration, and physics collision resolution.
 * @param {World} world - ECS World
 * @param {number} dtMs - Simulation timestep (16.67ms)
 * @param {MatterWorld} physicsWorld - MatterWorld physics instance
 */
export function movementSystem(world, dtMs, physicsWorld) {
  const entities = world.query([ComponentTypes.TRANSFORM, ComponentTypes.VELOCITY]);

  for (const entityId of entities) {
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);
    const velocity = world.getComponent(entityId, ComponentTypes.VELOCITY);
    const health = world.getComponent(entityId, ComponentTypes.HEALTH);
    const input = world.getComponent(entityId, ComponentTypes.INPUT_CONTROLLER);
    
    // Skip dead entities
    if (health && health.current <= 0) continue;

    // Check if active roll or dash is taking place
    const isDashing = transform.isDashing || false;
    const isRolling = transform.isRolling || false;

    if (!isDashing && !isRolling) {
      // 1. Process Horizontal Movement Input
      let moveDir = 0;
      let isRunning = false;

      if (input) {
        if (input.heldKeys['ArrowLeft'] || input.heldKeys['a']) {
          moveDir = -1;
        } else if (input.heldKeys['ArrowRight'] || input.heldKeys['d']) {
          moveDir = 1;
        }
        
        if (input.heldKeys['Shift']) {
          isRunning = true;
        }
      }

      // If entity has AI controller, we will read the moveDir set by AI later
      if (transform.aiMoveDir !== undefined) {
        moveDir = transform.aiMoveDir;
        isRunning = transform.aiIsRunning || false;
      }

      // Base stats speed multiplier (default: 1.0)
      const baseSpeedMod = transform.speedModifier || 1.0;
      
      // Select appropriate speed, acceleration, and deceleration
      const accel = isRunning ? MovementConstants.RUN_ACCEL : MovementConstants.WALK_ACCEL;
      const decel = isRunning ? MovementConstants.RUN_DECEL : MovementConstants.WALK_DECEL;
      const maxSpeed = (isRunning ? 3.5 : 2.5) * baseSpeedMod; // Knights slower, Assassins faster

      if (moveDir !== 0) {
        // Accelerate
        velocity.vx += moveDir * accel;
        // Clamp speed
        if (Math.abs(velocity.vx) > maxSpeed) {
          velocity.vx = moveDir * maxSpeed;
        }
        // Update facing direction
        transform.facing = moveDir;
      } else {
        // Decelerate
        if (velocity.vx > 0) {
          velocity.vx = Math.max(0, velocity.vx - decel);
        } else if (velocity.vx < 0) {
          velocity.vx = Math.min(0, velocity.vx + decel);
        }
      }

      // 2. Process Jumps (triggered by ActionResolutionSystem setting jump flags)
      if (transform.wantsToJump) {
        transform.wantsToJump = false;
        
        if (!transform.isAirborne) {
          // Normal ground jump
          velocity.vy = MovementConstants.JUMP_FORCE;
          transform.isAirborne = true;
          audioEngine.playSFX('jump', transform.x);
        } else if (transform.doubleJumpsLeft > 0) {
          // Double jump
          velocity.vy = MovementConstants.DOUBLE_JUMP_FORCE;
          transform.doubleJumpsLeft--;
          audioEngine.playSFX('jump', transform.x);
        }
      }
    }

    // 3. Resolve position and static AABB collisions
    resolvePlatformerMovement(world, entityId, physicsWorld, dtMs);
  }
}
