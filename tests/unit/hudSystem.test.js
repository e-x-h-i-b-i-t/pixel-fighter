import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { HudSystem } from '../../src/systems/18-hud/HudSystem.js';

describe('HUD & UI Systems', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  it('should skip instantiation when window context is missing', () => {
    const hud = new HudSystem(null);
    expect(hud.container).toBeNull();
    expect(hud.graphics).toBeNull();
  });

  it('should update HUD and draw player stats correctly when mock elements are set up', () => {
    const hud = new HudSystem(null);

    // Setup mocks
    const mockGraphics = {
      clear: vi.fn(),
      beginFill: vi.fn().mockReturnThis(),
      drawRect: vi.fn().mockReturnThis(),
      drawCircle: vi.fn().mockReturnThis(),
      endFill: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      arc: vi.fn().mockReturnThis()
    };
    
    hud.graphics = mockGraphics;
    hud.p1NameText = { text: '' };
    hud.p2NameText = { text: '' };
    hud.p1ComboText = { text: '', visible: false };
    hud.p2ComboText = { text: '', visible: false };

    // Create player entity (P1)
    const player = world.createEntity();
    world.addComponent(player, ComponentTypes.INPUT_CONTROLLER);
    world.addComponent(player, ComponentTypes.HEALTH, { current: 60, max: 120 }); // 50% HP
    world.addComponent(player, ComponentTypes.TRANSFORM, { characterClass: 'knight' });
    world.addComponent(player, ComponentTypes.STAMINA, { current: 80, max: 100 });
    world.addComponent(player, ComponentTypes.MANA, { current: 50, max: 100 });
    world.addComponent(player, ComponentTypes.ULTIMATE_METER, { current: 100, isReady: true });
    world.addComponent(player, ComponentTypes.COMBO_STATE, { chainIndex: 3 });

    // Call update
    hud.update(world);

    // Assert name text was set
    expect(hud.p1NameText.text).toBe('P1: KNIGHT');

    // Assert health bar drawing coordinates (50% of 180 = 90 width)
    expect(mockGraphics.drawRect).toHaveBeenCalledWith(20, 26, 90, 12);
    
    // Assert stamina and mana bar fills
    expect(mockGraphics.drawRect).toHaveBeenCalledWith(20, 42, 80, 5); // 80% stamina
    expect(mockGraphics.drawRect).toHaveBeenCalledWith(20, 50, 50, 5); // 50% mana

    // Assert combo text was set
    expect(hud.p1ComboText.text).toBe('3 HITS!');
    expect(hud.p1ComboText.visible).toBe(true);
  });
});
