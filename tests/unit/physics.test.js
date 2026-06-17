import { describe, it, expect, beforeEach } from 'vitest';
import Matter from 'matter-js';
import { MatterWorld, CollisionCategories } from '../../src/physics/MatterWorld.js';

describe('Physics Bootstrap & MatterWorld', () => {
  let physics;

  beforeEach(() => {
    physics = new MatterWorld();
  });

  it('should initialize Matter engine and world with zero gravity', () => {
    expect(physics.engine).toBeDefined();
    expect(physics.world).toBeDefined();
    expect(physics.engine.gravity.x).toBe(0);
    expect(physics.engine.gravity.y).toBe(0);
  });

  it('should create and register static geometry', () => {
    const rect = physics.createStaticRect(100, 200, 50, 10);
    expect(rect.isStatic).toBe(true);
    expect(rect.position.x).toBe(100);
    expect(rect.position.y).toBe(200);
    expect(rect.collisionFilter.category).toBe(CollisionCategories.STATIC);
    
    // Check it exists in world bodies
    const bodies = Matter.Composite.allBodies(physics.world);
    expect(bodies.some(b => b.id === rect.id)).toBe(true);
  });

  it('should map bodies to entities and handle lifecycle', () => {
    const body = Matter.Bodies.rectangle(0, 0, 10, 10);
    const entityId = 42;
    
    physics.registerBody(body, entityId);
    expect(physics.bodyToEntity.get(body.id)).toBe(entityId);
    
    let bodies = Matter.Composite.allBodies(physics.world);
    expect(bodies.some(b => b.id === body.id)).toBe(true);

    physics.unregisterBody(body);
    expect(physics.bodyToEntity.has(body.id)).toBe(false);
    
    bodies = Matter.Composite.allBodies(physics.world);
    expect(bodies.some(b => b.id === body.id)).toBe(false);
  });
});
