import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { ComponentTypes, ComponentFactories } from '../ecs/componentTypes.js';
import { CollisionCategories } from '../physics/MatterWorld.js';
import { getCharacterAnimations } from '../rendering/proceduralAssets.js';

export const CharacterTemplates = {
  knight: {
    maxHp: 120,
    speedModifier: 0.85,
    baseCritChance: 5.0,
    defenseModifier: 0.15,
    weightModifier: 1.25,
    hurtboxSize: { width: 32, height: 48 }
  },
  samurai: {
    maxHp: 100,
    speedModifier: 1.00,
    baseCritChance: 12.0,
    defenseModifier: 0.05,
    weightModifier: 1.00,
    hurtboxSize: { width: 28, height: 48 }
  },
  assassin: {
    maxHp: 80,
    speedModifier: 1.25,
    baseCritChance: 20.0,
    defenseModifier: 0.00,
    weightModifier: 0.75,
    hurtboxSize: { width: 24, height: 48 }
  },
  mage: {
    maxHp: 90,
    speedModifier: 0.95,
    baseCritChance: 8.0,
    defenseModifier: 0.05,
    weightModifier: 0.90,
    hurtboxSize: { width: 28, height: 48 }
  }
};

/**
 * Initializes character components on an ECS entity.
 * @param {World} world 
 * @param {number} entityId 
 * @param {MatterWorld} physicsWorld 
 * @param {string} charClass - 'knight' | 'samurai' | 'assassin' | 'mage'
 * @param {number} startX 
 * @param {number} startY 
 * @param {boolean} isPlayer - If true, adds InputController; else adds AIController
 */
export function loadCharacter(world, entityId, physicsWorld, charClass, startX, startY, isPlayer = true) {
  const template = CharacterTemplates[charClass] || CharacterTemplates.knight;

  // 1. Setup Matter.js sensor body for the hurtbox
  const body = Matter.Bodies.rectangle(startX, startY, template.hurtboxSize.width, template.hurtboxSize.height, {
    isSensor: true,
    isStatic: false,
    collisionFilter: {
      category: CollisionCategories.HURTBOX,
      mask: CollisionCategories.HITBOX
    },
    label: `hurtbox_${charClass}`
  });

  physicsWorld.registerBody(body, entityId);

  // 2. Add ECS Components
  world.addComponent(entityId, ComponentTypes.TRANSFORM, {
    x: startX,
    y: startY,
    facing: isPlayer ? 1 : -1,
    characterClass: charClass,
    speedModifier: template.speedModifier,
    baseCritChance: template.baseCritChance,
    defenseModifier: template.defenseModifier,
    weightModifier: template.weightModifier
  });

  world.addComponent(entityId, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });

  world.addComponent(entityId, ComponentTypes.HEALTH, {
    current: template.maxHp,
    max: template.maxHp,
    isInvulnerable: false
  });

  world.addComponent(entityId, ComponentTypes.STAMINA, {
    current: 100,
    max: 100,
    regenRate: 0.3
  });

  world.addComponent(entityId, ComponentTypes.MANA, {
    current: 100,
    max: 100,
    regenRate: 0.1
  });

  world.addComponent(entityId, ComponentTypes.ULTIMATE_METER, {
    current: 0,
    isReady: false
  });

  world.addComponent(entityId, ComponentTypes.COMBO_STATE, {
    chainIndex: 0,
    comboTimer: 0
  });

  world.addComponent(entityId, ComponentTypes.STATUS_EFFECTS, {
    active: []
  });

  world.addComponent(entityId, ComponentTypes.ANIMATION_STATE, {
    currentClip: 'idle',
    frameIndex: 0,
    frameTimer: 0
  });

  world.addComponent(entityId, ComponentTypes.PHYSICS_BODY, {
    matterBodyId: body.id,
    bodyType: 'kinematic',
    collisionGroup: CollisionCategories.HURTBOX
  });

  world.addComponent(entityId, ComponentTypes.HURTBOX, {
    shape: 'box',
    size: { width: template.hurtboxSize.width, height: template.hurtboxSize.height }
  });

  // Assign inputs
  if (isPlayer) {
    world.addComponent(entityId, ComponentTypes.INPUT_CONTROLLER);
  } else {
    world.addComponent(entityId, ComponentTypes.AI_CONTROLLER, {
      difficulty: 'medium',
      reactionTimer: 0,
      targetEntityId: null
    });
  }

  // Generate procedural textures if window context is present (running in browser)
  if (typeof window !== 'undefined') {
    const animations = getCharacterAnimations(charClass);
    
    // Create actual PIXI Sprite (using first frame of idle)
    const pixiSprite = new PIXI.Sprite(animations.idle[0]);
    pixiSprite.anchor.set(0.5, 1.0); // anchor at bottom-center

    world.addComponent(entityId, ComponentTypes.SPRITE_REF, {
      sprite: pixiSprite,
      animations: animations
    });
  } else {
    // Headless / Test mock sprite fallback
    world.addComponent(entityId, ComponentTypes.SPRITE_REF, {
      sprite: { position: { set: () => {} }, scale: { set: () => {} }, anchor: { set: () => {} } },
      animations: null
    });
  }
}
