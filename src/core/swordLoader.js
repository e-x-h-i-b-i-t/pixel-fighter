import { ComponentTypes } from '../ecs/componentTypes.js';

export const SwordsRegistry = {
  steelBroadsword: {
    name: 'Steel Broadsword',
    damageMultiplier: 1.0,
    critModifier: 0.0,
    description: 'A standard steel sword with balanced handling.'
  },
  flameTongue: {
    name: 'Flame Tongue',
    damageMultiplier: 1.1,
    critModifier: 0.0,
    elementalEffect: { type: 'burn', value: 3, duration: 180 }, // deals 3 dmg every 30 frames for 3s
    description: 'Imbued with fire, deals burn damage over time.'
  },
  frostBrand: {
    name: 'Frost Brand',
    damageMultiplier: 0.95,
    critModifier: 0.0,
    elementalEffect: { type: 'freeze', value: 0.4, duration: 120 }, // 60% slow for 2s
    description: 'Cold steel that slows enemy movement.'
  },
  stormBringer: {
    name: 'Storm Bringer',
    damageMultiplier: 1.0,
    critModifier: 0.0,
    elementalEffect: { type: 'shock', value: 8, duration: 1 }, // +8 extra hitstun frames
    description: 'Shocking attacks that increase hitstun.'
  },
  vampiricBlade: {
    name: 'Vampiric Blade',
    damageMultiplier: 0.9,
    critModifier: 0.0,
    lifestealRatio: 0.20, // 20% lifesteal
    description: 'Drains health from your opponent to heal you.'
  },
  executionerAxe: {
    name: "Executioner's Axe",
    damageMultiplier: 1.25, // heavy swing
    critModifier: 0.0,
    description: 'Slow, heavy strikes that deal crushing damage.'
  },
  muramasa: {
    name: 'Muramasa',
    damageMultiplier: 1.0,
    critModifier: 15.0, // +15% crit
    description: 'Cursed sword with elevated critical chance.'
  },
  spellfireEdge: {
    name: 'Spellfire Edge',
    damageMultiplier: 0.95,
    critModifier: 0.0,
    manaRestore: 8,
    description: 'Absorbs mana from targets on hit.'
  }
};

/**
 * Equips a sword onto an ECS entity.
 * @param {World} world 
 * @param {number} entityId 
 * @param {string} swordId 
 */
export function equipSword(world, entityId, swordId) {
  const template = SwordsRegistry[swordId] || SwordsRegistry.steelBroadsword;
  
  world.addComponent(entityId, ComponentTypes.SWORD_LOADOUT, {
    swordId,
    damageMultiplier: template.damageMultiplier || 1.0,
    critModifier: template.critModifier || 0.0,
    lifestealRatio: template.lifestealRatio || 0,
    manaRestore: template.manaRestore || 0,
    elementalEffect: template.elementalEffect || null
  });
}
