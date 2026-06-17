import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { aiSystem } from '../../src/systems/01-ai/AISystem.js';

describe('AI Decision System', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  it('should pursue the player when player is far away', () => {
    // Player at x = 300
    const player = world.createEntity();
    world.addComponent(player, ComponentTypes.INPUT_CONTROLLER);
    world.addComponent(player, ComponentTypes.TRANSFORM, { x: 300, y: 100 });

    // AI at x = 100 (needs to go right)
    const ai = world.createEntity();
    world.addComponent(ai, ComponentTypes.AI_CONTROLLER, { difficulty: 'medium', reactionTimer: 0 });
    world.addComponent(ai, ComponentTypes.TRANSFORM, { x: 100, y: 100 });

    aiSystem(world);

    const aiTransform = world.getComponent(ai, ComponentTypes.TRANSFORM);
    expect(aiTransform.aiMoveDir).toBe(1); // right
    expect(aiTransform.aiIsRunning).toBe(true);
  });

  it('should trigger attacks when in range of the player', () => {
    // Player at x = 120
    const player = world.createEntity();
    world.addComponent(player, ComponentTypes.INPUT_CONTROLLER);
    world.addComponent(player, ComponentTypes.TRANSFORM, { x: 120, y: 100 });

    // AI at x = 100 (distance = 20)
    const ai = world.createEntity();
    world.addComponent(ai, ComponentTypes.AI_CONTROLLER, { difficulty: 'nightmare', reactionTimer: 0 });
    world.addComponent(ai, ComponentTypes.TRANSFORM, { x: 100, y: 100 });

    // Mock random to force attack decision
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    aiSystem(world);

    const aiTransform = world.getComponent(ai, ComponentTypes.TRANSFORM);
    expect(aiTransform.aiMoveDir).toBe(0); // stops moving
    expect(aiTransform.aiBufferedAction).toBeDefined(); // attack chosen
    expect(['lightAttack', 'heavyAttack']).toContain(aiTransform.aiBufferedAction);

    randomSpy.mockRestore();
  });

  it('should try to defend when player is attacking in close range', () => {
    // Player at x = 110, attacking
    const player = world.createEntity();
    world.addComponent(player, ComponentTypes.INPUT_CONTROLLER);
    world.addComponent(player, ComponentTypes.TRANSFORM, { x: 110, y: 100 });
    world.addComponent(player, ComponentTypes.ANIMATION_STATE, { currentClip: 'attack' });

    // AI at x = 100
    const ai = world.createEntity();
    world.addComponent(ai, ComponentTypes.AI_CONTROLLER, { difficulty: 'nightmare', reactionTimer: 0 });
    world.addComponent(ai, ComponentTypes.TRANSFORM, { x: 100, y: 100 });

    // Mock random to guarantee defensive action selection
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

    aiSystem(world);

    const aiTransform = world.getComponent(ai, ComponentTypes.TRANSFORM);
    expect(aiTransform.aiBufferedAction).toBeDefined();
    expect(['roll', 'jump', 'parry']).toContain(aiTransform.aiBufferedAction);

    randomSpy.mockRestore();
  });

  it('should adaptively adjust difficulty based on player vs AI health percentages', () => {
    // Player: healthy (100/100)
    const player = world.createEntity();
    world.addComponent(player, ComponentTypes.INPUT_CONTROLLER);
    world.addComponent(player, ComponentTypes.TRANSFORM, { x: 300, y: 100 });
    world.addComponent(player, ComponentTypes.HEALTH, { current: 100, max: 100 });

    // AI: losing badly (30/100)
    const ai = world.createEntity();
    world.addComponent(ai, ComponentTypes.AI_CONTROLLER, { difficulty: 'medium', reactionTimer: 0 });
    world.addComponent(ai, ComponentTypes.TRANSFORM, { x: 100, y: 100 });
    world.addComponent(ai, ComponentTypes.HEALTH, { current: 30, max: 100 });

    aiSystem(world);

    const controller = world.getComponent(ai, ComponentTypes.AI_CONTROLLER);
    // Medium difficulty should be bumped to Hard!
    expect(controller.difficulty).toBe('hard');

    // Reset health: make AI healthy (100/100), Player low (20/100)
    const aiHealth = world.getComponent(ai, ComponentTypes.HEALTH);
    const playerHealth = world.getComponent(player, ComponentTypes.HEALTH);
    aiHealth.current = 100;
    playerHealth.current = 20;

    // Reset reaction timer so it re-evaluates
    controller.reactionTimer = 0;

    aiSystem(world);
    // Original difficulty (medium) should dial down to Easy to assist the player!
    expect(controller.difficulty).toBe('easy');
  });
});
