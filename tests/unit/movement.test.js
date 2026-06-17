import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { MatterWorld } from '../../src/physics/MatterWorld.js';
import { movementSystem } from '../../src/systems/04-movement/MovementSystem.js';
import { MovementConstants } from '../../src/physics/platformerMovement.js';

describe('Locomotion & Custom Platformer Movement', () => {
  let world;
  let physics;

  beforeEach(() => {
    world = new World();
    physics = new MatterWorld();
  });

  it('should fall due to gravity when in the air', () => {
    const entity = world.createEntity();
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 100, y: 100 });
    world.addComponent(entity, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });

    // Run one tick of movement system (dt = 16.67ms)
    movementSystem(world, 16.67, physics);

    const transform = world.getComponent(entity, ComponentTypes.TRANSFORM);
    const velocity = world.getComponent(entity, ComponentTypes.VELOCITY);

    // Gravity should accelerate velocity.vy downwards (positive Y is down)
    expect(velocity.vy).toBe(MovementConstants.GRAVITY);
    expect(transform.y).toBe(100 + MovementConstants.GRAVITY);
    expect(transform.isAirborne).toBe(true);
  });

  it('should collide with static floor and stop falling', () => {
    // Create static floor at y = 200 (thickness 20, extends from x = 0 to 200)
    // Floor center: x=100, y=210, width=200, height=20 (bounds: y: 200 to 220)
    physics.createStaticRect(100, 210, 200, 20);

    const entity = world.createEntity();
    // Entity height is 48. If y is 199, bottom-center is at 199.
    // Falling by gravity will push bottom-center past 200, trigger collision, and snap bottom-center to y = 200.
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 100, y: 199 });
    world.addComponent(entity, ComponentTypes.VELOCITY, { vx: 0, vy: 2.0 });

    movementSystem(world, 16.67, physics);

    const transform = world.getComponent(entity, ComponentTypes.TRANSFORM);
    const velocity = world.getComponent(entity, ComponentTypes.VELOCITY);

    // Should snap to floor (y = 200) and set vertical velocity to 0
    expect(transform.y).toBe(200);
    expect(velocity.vy).toBe(0);
    expect(transform.isAirborne).toBe(false);
  });

  it('should execute double jumps and consume charges', () => {
    physics.createStaticRect(100, 210, 200, 20);

    const entity = world.createEntity();
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 100, y: 200 });
    world.addComponent(entity, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });

    // Grounded initially, trigger wantsToJump
    let transform = world.getComponent(entity, ComponentTypes.TRANSFORM);
    let velocity = world.getComponent(entity, ComponentTypes.VELOCITY);
    
    transform.wantsToJump = true;
    movementSystem(world, 16.67, physics);

    // Should have jump velocity + gravity integration
    expect(velocity.vy).toBe(MovementConstants.JUMP_FORCE + MovementConstants.GRAVITY);
    expect(transform.isAirborne).toBe(true);
    expect(transform.doubleJumpsLeft).toBe(1);

    // Apply gravity for a step, then trigger double jump
    movementSystem(world, 16.67, physics);
    
    transform.wantsToJump = true;
    movementSystem(world, 16.67, physics);

    // Double jump velocity + gravity integration
    expect(velocity.vy).toBe(MovementConstants.DOUBLE_JUMP_FORCE + MovementConstants.GRAVITY);
    expect(transform.doubleJumpsLeft).toBe(0);

    // Try to jump again (charges should be exhausted)
    transform.wantsToJump = true;
    movementSystem(world, 16.67, physics);
    
    // vy should just be affected by gravity now, not jump force
    expect(velocity.vy).not.toBe(MovementConstants.DOUBLE_JUMP_FORCE);
  });

  it('should run dash and roll timers and apply constant speeds', () => {
    const entity = world.createEntity();
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 100, y: 100, facing: 1 });
    world.addComponent(entity, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });

    const transform = world.getComponent(entity, ComponentTypes.TRANSFORM);
    const velocity = world.getComponent(entity, ComponentTypes.VELOCITY);

    // Trigger dash
    transform.isDashing = true;
    transform.dashTicks = 0;

    // Tick 1
    movementSystem(world, 16.67, physics);
    expect(velocity.vx).toBe(MovementConstants.DASH_SPEED);
    expect(velocity.vy).toBe(0); // Gravity ignored
    expect(transform.dashTicks).toBe(1);

    // Simulate ticking until dash ends (duration is 5 ticks)
    for (let i = 0; i < 4; i++) {
      movementSystem(world, 16.67, physics);
    }

    expect(transform.isDashing).toBe(false);
    expect(velocity.vx).toBe(0);
  });
});
