import * as PIXI from 'pixi.js';

export function createRenderLayers(viewport) {
  // Clear any existing children in viewport
  viewport.removeChildren();

  // 1. Arena layers (holds background elements)
  const arenaLayer = new PIXI.Container();
  arenaLayer.name = 'arenaLayer';
  viewport.addChild(arenaLayer);

  // 2. Weather Layer (lives inside/overlayed in arena but behind players)
  const weatherLayer = new PIXI.Container();
  weatherLayer.name = 'weatherLayer';
  viewport.addChild(weatherLayer);

  // 3. Gameplay Layer
  const gameplayLayer = new PIXI.Container();
  gameplayLayer.name = 'gameplayLayer';
  viewport.addChild(gameplayLayer);

  // Sub-layers inside gameplay layer
  const shadowLayer = new PIXI.Container();
  shadowLayer.name = 'shadowLayer';
  gameplayLayer.addChild(shadowLayer);

  const entityLayer = new PIXI.Container();
  entityLayer.name = 'entityLayer';
  // Enable sorting by zIndex / y position
  entityLayer.sortableChildren = true;
  gameplayLayer.addChild(entityLayer);

  const vfxLayer = new PIXI.Container();
  vfxLayer.name = 'vfxLayer';
  gameplayLayer.addChild(vfxLayer);

  // 4. Foreground Layer (occludes players)
  const foregroundLayer = new PIXI.Container();
  foregroundLayer.name = 'foregroundLayer';
  viewport.addChild(foregroundLayer);

  // 5. UI Layer (HUD, meters, timer)
  const uiLayer = new PIXI.Container();
  uiLayer.name = 'uiLayer';
  viewport.addChild(uiLayer);

  // 6. Overlay Layer (pause menus, overlays, transition screens)
  const overlayLayer = new PIXI.Container();
  overlayLayer.name = 'overlayLayer';
  viewport.addChild(overlayLayer);

  return {
    arenaLayer,
    weatherLayer,
    gameplayLayer,
    shadowLayer,
    entityLayer,
    vfxLayer,
    foregroundLayer,
    uiLayer,
    overlayLayer
  };
}
