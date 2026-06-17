import * as PIXI from 'pixi.js';
import {
  generateParallaxBackground,
  generateParallaxMidground,
  generatePlatformTexture
} from '../rendering/proceduralAssets.js';

export const ArenaTemplates = {
  forestTemple: {
    width: 1280,
    height: 360,
    groundY: 310,
    platforms: [
      { x: 320, y: 220, w: 160, h: 16 },
      { x: 960, y: 220, w: 160, h: 16 },
      { x: 640, y: 140, w: 200, h: 16 }
    ]
  },
  frozenMountain: {
    width: 1280,
    height: 360,
    groundY: 310,
    platforms: [
      { x: 250, y: 230, w: 140, h: 16 },
      { x: 1030, y: 230, w: 140, h: 16 },
      { x: 640, y: 160, w: 160, h: 16 },
      { x: 640, y: 80, w: 100, h: 16 }
    ]
  },
  volcano: {
    width: 1280,
    height: 360,
    groundY: 320,
    platforms: [
      { x: 400, y: 220, w: 180, h: 16 },
      { x: 880, y: 220, w: 180, h: 16 }
    ]
  },
  darkCastle: {
    width: 1280,
    height: 360,
    groundY: 310,
    platforms: [
      { x: 200, y: 220, w: 120, h: 16 },
      { x: 1080, y: 220, w: 120, h: 16 },
      { x: 440, y: 150, w: 150, h: 16 },
      { x: 840, y: 150, w: 150, h: 16 }
    ]
  },
  skyKingdom: {
    width: 1280,
    height: 360,
    groundY: 310,
    platforms: [
      { x: 300, y: 210, w: 150, h: 16 },
      { x: 980, y: 210, w: 150, h: 16 },
      { x: 640, y: 130, w: 180, h: 16 }
    ]
  }
};

/**
 * Loads an arena, setting up static physics geometry and rendering layers.
 * @param {string} arenaId - 'forestTemple' | 'frozenMountain' | 'volcano' | 'darkCastle' | 'skyKingdom'
 * @param {MatterWorld} physicsWorld 
 * @param {PixiApp} pixiApp - Optional PixiApp wrapper for rendering setup
 * @returns {Object} Arena properties (width, height, groundY)
 */
export function loadArena(arenaId, physicsWorld, pixiApp = null) {
  const template = ArenaTemplates[arenaId] || ArenaTemplates.forestTemple;

  // 1. CLEAR previous static bodies
  physicsWorld.clearStaticBodies();

  // 2. CREATE floor static physics body
  // Floor center: x=width/2, y=groundY + (height-groundY)/2, width=width, height=height-groundY
  const floorHeight = template.height - template.groundY;
  const floorY = template.groundY + floorHeight / 2;
  physicsWorld.createStaticRect(template.width / 2, floorY, template.width, floorHeight);

  // 3. CREATE left & right boundary walls
  physicsWorld.createStaticRect(-10, template.height / 2, 20, template.height);
  physicsWorld.createStaticRect(template.width + 10, template.height / 2, 20, template.height);

  // 4. CREATE platform static bodies
  for (const plat of template.platforms) {
    physicsWorld.createStaticRect(plat.x, plat.y + plat.h / 2, plat.w, plat.h);
  }

  // 5. SETUP Pixi rendering layers if present
  if (pixiApp && typeof window !== 'undefined') {
    const layers = pixiApp.layers;
    if (!layers) return { width: template.width, height: template.height, groundY: template.groundY };

    // Clear old arena visuals
    layers.arenaLayer.removeChildren();

    // Clear static geometry group from entity layer
    const oldStatic = layers.entityLayer.children.find(c => c.label === 'staticGeometry');
    if (oldStatic) {
      layers.entityLayer.removeChild(oldStatic);
    }

    // Static geometry container (floor + platforms visuals)
    const staticGroup = new PIXI.Container();
    staticGroup.label = 'staticGeometry';
    layers.entityLayer.addChildAt(staticGroup, 0); // behind fighters

    // --- Parallax Background ---
    const bgTex = generateParallaxBackground(arenaId, template.width, template.height);
    const bgSprite = new PIXI.Sprite(bgTex);
    layers.arenaLayer.addChild(bgSprite);

    // --- Parallax Midground ---
    const mgTex = generateParallaxMidground(arenaId, template.width, template.height);
    const mgSprite = new PIXI.Sprite(mgTex);
    layers.arenaLayer.addChild(mgSprite);

    // --- Gameplay Floor Visual ---
    const floorTex = generatePlatformTexture(arenaId, template.width, floorHeight);
    const floorSprite = new PIXI.Sprite(floorTex);
    floorSprite.position.set(0, template.groundY);
    staticGroup.addChild(floorSprite);

    // --- Gameplay Platform Visuals ---
    for (const plat of template.platforms) {
      const platTex = generatePlatformTexture(arenaId, plat.w, plat.h);
      const platSprite = new PIXI.Sprite(platTex);
      platSprite.position.set(plat.x - plat.w / 2, plat.y);
      staticGroup.addChild(platSprite);
    }
  }

  return {
    width: template.width,
    height: template.height,
    groundY: template.groundY
  };
}
