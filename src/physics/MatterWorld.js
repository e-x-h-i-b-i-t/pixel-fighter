import Matter from 'matter-js';

export const CollisionCategories = {
  STATIC: 0x0001,
  FIGHTER: 0x0002,
  HURTBOX: 0x0004,
  HITBOX: 0x0008,
  SENSOR: 0x0010
};

export class MatterWorld {
  constructor() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 } // Custom gravity is used for platformer movement
    });
    this.world = this.engine.world;
    
    // Map of matterBodyId -> entityId
    this.bodyToEntity = new Map();
  }

  update(dtMs) {
    // Step the physics engine
    Matter.Engine.update(this.engine, dtMs);
  }

  /**
   * Register a body mapping to an entity
   * @param {Matter.Body} body 
   * @param {number} entityId 
   */
  registerBody(body, entityId) {
    this.bodyToEntity.set(body.id, entityId);
    Matter.Composite.add(this.world, body);
  }

  /**
   * Unregister and remove a body
   * @param {Matter.Body} body 
   */
  unregisterBody(body) {
    if (!body) return;
    this.bodyToEntity.delete(body.id);
    Matter.Composite.remove(this.world, body);
  }

  /**
   * Add static rectangles representing walls, ground, or platforms.
   * @param {number} x 
   * @param {number} y 
   * @param {number} width 
   * @param {number} height 
   * @param {Object} [options] 
   * @returns {Matter.Body}
   */
  createStaticRect(x, y, width, height, options = {}) {
    const body = Matter.Bodies.rectangle(x, y, width, height, {
      isStatic: true,
      collisionFilter: {
        category: CollisionCategories.STATIC,
        mask: CollisionCategories.FIGHTER // Ground interacts only with main fighter bodies
      },
      label: 'static_geometry',
      ...options
    });
    Matter.Composite.add(this.world, body);
    return body;
  }

  clearStaticBodies() {
    const staticBodies = Matter.Composite.allBodies(this.world).filter(b => b.isStatic);
    for (const body of staticBodies) {
      Matter.Composite.remove(this.world, body);
    }
  }

  clear() {
    Matter.Composite.clear(this.world, false);
    this.bodyToEntity.clear();
  }
}
