import { ComponentTypes } from '../../ecs/componentTypes.js';

/**
 * ECS System to synchronize ECS Transform coordinates and AnimationStates with PixiJS sprites.
 * Runs in Step 17 of the execution loop (after simulation steps).
 * @param {World} world 
 */
export function renderSyncSystem(world) {
  const entities = world.query([ComponentTypes.TRANSFORM, ComponentTypes.SPRITE_REF]);

  for (const entityId of entities) {
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);
    const spriteRef = world.getComponent(entityId, ComponentTypes.SPRITE_REF);
    const anim = world.getComponent(entityId, ComponentTypes.ANIMATION_STATE);

    if (!transform || !spriteRef || !spriteRef.sprite) continue;

    const pixiSprite = spriteRef.sprite;

    // 1. Sync Position, Rotation, Scale, and Facing direction
    pixiSprite.position.set(transform.x, transform.y);
    pixiSprite.rotation = transform.rotation;
    
    // Scale X is flipped depending on facing direction
    const facing = transform.facing || 1;
    const baseScale = transform.scale || 1.0;
    
    // Set anchor to bottom-center (0.5, 1.0) so scaling and rotation rotate about the feet/ground
    if (pixiSprite.anchor) {
      pixiSprite.anchor.set(0.5, 1.0);
    }
    
    pixiSprite.scale.set(baseScale * facing, baseScale);

    // 2. Sync Active Animation Frame texture
    if (anim && spriteRef.animations) {
      const clipTextures = spriteRef.animations[anim.currentClip];
      if (clipTextures && clipTextures.length > 0) {
        const frameTexture = clipTextures[anim.frameIndex % clipTextures.length];
        if (frameTexture && pixiSprite.texture !== frameTexture) {
          pixiSprite.texture = frameTexture;
        }
      }
    }
  }
}
