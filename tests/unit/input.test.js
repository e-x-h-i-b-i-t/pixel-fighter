import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { InputSystem, ActionMap } from '../../src/systems/02-input/InputSystem.js';

describe('Inputs & InputSystem', () => {
  let world;
  let inputSystem;
  let playerEntity;

  beforeEach(() => {
    world = new World();
    playerEntity = world.createEntity();
    world.addComponent(playerEntity, ComponentTypes.INPUT_CONTROLLER);
    
    // Stub global window addEventListener
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    inputSystem = new InputSystem();
  });

  afterEach(() => {
    inputSystem.unbindEvents();
    delete global.window;
    vi.restoreAllMocks();
  });

  it('should register event listeners on creation and remove them on destroy', () => {
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));

    inputSystem.unbindEvents();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
  });

  it('should capture held keys on keydown and keyup', () => {
    // Simulate pressing space
    inputSystem.handleKeyDown({ key: ' ', repeat: false, preventDefault: () => {} });
    inputSystem.update(world, 16.67);

    const controller = world.getComponent(playerEntity, ComponentTypes.INPUT_CONTROLLER);
    expect(controller.heldKeys[' ']).toBe(true);

    // Simulate release
    inputSystem.handleKeyUp({ key: ' ' });
    inputSystem.update(world, 16.67);
    expect(controller.heldKeys[' ']).toBe(false);
  });

  it('should map keyboard buttons to game actions and buffer them', () => {
    // Press 'j' (light attack)
    inputSystem.handleKeyDown({ key: 'j', repeat: false, preventDefault: () => {} });
    inputSystem.update(world, 16.67);

    const controller = world.getComponent(playerEntity, ComponentTypes.INPUT_CONTROLLER);
    expect(controller.bufferedInputs.length).toBe(1);
    expect(controller.bufferedInputs[0].action).toBe('lightAttack');
    expect(controller.bufferedInputs[0].consumed).toBe(false);
  });

  it('should clean up expired inputs from the buffer', () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Press 'j'
    inputSystem.handleKeyDown({ key: 'j', repeat: false, preventDefault: () => {} });
    inputSystem.update(world, 16.67);

    const controller = world.getComponent(playerEntity, ComponentTypes.INPUT_CONTROLLER);
    expect(controller.bufferedInputs.length).toBe(1);

    // Advance time by 600ms (exceeds BUFFER_EXPIRATION_MS = 500ms)
    vi.advanceTimersByTime(600);
    inputSystem.update(world, 16.67);

    // The expired input should be filtered out
    expect(controller.bufferedInputs.length).toBe(0);

    vi.useRealTimers();
  });
});
