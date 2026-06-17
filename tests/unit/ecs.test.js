import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { Entity } from '../../src/ecs/Entity.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';

describe('ECS Core Framework', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  it('should create and destroy entities correctly', () => {
    const e1 = world.createEntity();
    const e2 = world.createEntity();

    expect(world.entities.has(e1)).toBe(true);
    expect(world.entities.has(e2)).toBe(true);
    expect(e1).not.toBe(e2);

    world.destroyEntity(e1);
    expect(world.entities.has(e1)).toBe(false);
    expect(world.entities.has(e2)).toBe(true);
  });

  it('should add, get and remove components correctly', () => {
    const e = world.createEntity();
    
    world.addComponent(e, ComponentTypes.TRANSFORM, { x: 10, y: 20 });
    expect(world.hasComponent(e, ComponentTypes.TRANSFORM)).toBe(true);
    
    const transform = world.getComponent(e, ComponentTypes.TRANSFORM);
    expect(transform.x).toBe(10);
    expect(transform.y).toBe(20);
    expect(transform.rotation).toBe(0); // Default value

    world.removeComponent(e, ComponentTypes.TRANSFORM);
    expect(world.hasComponent(e, ComponentTypes.TRANSFORM)).toBe(false);
    expect(world.getComponent(e, ComponentTypes.TRANSFORM)).toBeUndefined();
  });

  it('should query entities matching components signatures', () => {
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    world.addComponent(e1, ComponentTypes.TRANSFORM, { x: 5 });
    world.addComponent(e1, ComponentTypes.VELOCITY, { vx: 2 });

    world.addComponent(e2, ComponentTypes.TRANSFORM, { x: 10 });

    world.addComponent(e3, ComponentTypes.VELOCITY, { vx: -1 });

    const transformQuery = world.query([ComponentTypes.TRANSFORM]);
    expect(transformQuery).toContain(e1);
    expect(transformQuery).toContain(e2);
    expect(transformQuery).not.toContain(e3);

    const fullQuery = world.query([ComponentTypes.TRANSFORM, ComponentTypes.VELOCITY]);
    expect(fullQuery).toContain(e1);
    expect(fullQuery).not.toContain(e2);
    expect(fullQuery).not.toContain(e3);
  });

  it('should wrap entities using Entity helper', () => {
    const entity = new Entity(world);
    entity.addComponent(ComponentTypes.TRANSFORM, { x: 42 });
    
    expect(world.hasComponent(entity.id, ComponentTypes.TRANSFORM)).toBe(true);
    expect(entity.getComponent(ComponentTypes.TRANSFORM).x).toBe(42);

    entity.removeComponent(ComponentTypes.TRANSFORM);
    expect(entity.hasComponent(ComponentTypes.TRANSFORM)).toBe(false);
  });
});
