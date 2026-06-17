import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { MatterWorld } from '../../src/physics/MatterWorld.js';
import { loadCharacter, CharacterTemplates } from '../../src/core/characterLoader.js';

describe('Character Loader', () => {
  let world;
  let physics;

  beforeEach(() => {
    world = new World();
    physics = new MatterWorld();
  });

  it('should initialize a Knight character with correct stats and hurtbox body', () => {
    const entity = world.createEntity();
    loadCharacter(world, entity, physics, 'knight', 100, 150, true);

    // Assert ECS components
    const transform = world.getComponent(entity, ComponentTypes.TRANSFORM);
    const health = world.getComponent(entity, ComponentTypes.HEALTH);
    const stamina = world.getComponent(entity, ComponentTypes.STAMINA);
    const phys = world.getComponent(entity, ComponentTypes.PHYSICS_BODY);
    const input = world.getComponent(entity, ComponentTypes.INPUT_CONTROLLER);

    expect(transform.characterClass).toBe('knight');
    expect(transform.speedModifier).toBe(CharacterTemplates.knight.speedModifier);
    expect(transform.defenseModifier).toBe(CharacterTemplates.knight.defenseModifier);
    expect(transform.weightModifier).toBe(CharacterTemplates.knight.weightModifier);
    
    expect(health.current).toBe(120);
    expect(health.max).toBe(120);
    expect(stamina.current).toBe(100);
    expect(input).toBeDefined();

    // Verify physics body registration
    expect(phys.matterBodyId).not.toBeNull();
    const body = physics.world.bodies.find(b => b.id === phys.matterBodyId);
    expect(body).toBeDefined();
    expect(body.isSensor).toBe(true);
    expect(body.position.x).toBe(100);
    expect(body.position.y).toBe(150);
  });

  it('should load AI controllers instead of Input controllers when requested', () => {
    const entity = world.createEntity();
    loadCharacter(world, entity, physics, 'samurai', 200, 150, false); // isPlayer = false

    const input = world.getComponent(entity, ComponentTypes.INPUT_CONTROLLER);
    const ai = world.getComponent(entity, ComponentTypes.AI_CONTROLLER);

    expect(input).toBeUndefined();
    expect(ai).toBeDefined();
    expect(ai.difficulty).toBe('medium');
  });
});
