import { ComponentFactories } from './componentTypes.js';

export class World {
  constructor() {
    this.nextEntityId = 1;
    this.entities = new Set();
    // Maps componentName -> Map(entityId -> componentData)
    this.components = new Map();
    // Cache for queries
    this.queryCache = new Map();
    this.cacheDirty = false;
  }

  createEntity() {
    const id = this.nextEntityId++;
    this.entities.add(id);
    this.cacheDirty = true;
    return id;
  }

  destroyEntity(entityId) {
    if (!this.entities.has(entityId)) return;
    
    // Remove from entities set
    this.entities.delete(entityId);
    
    // Remove all associated components
    for (const [componentName, entityMap] of this.components.entries()) {
      if (entityMap.has(entityId)) {
        entityMap.delete(entityId);
      }
    }
    
    this.cacheDirty = true;
  }

  addComponent(entityId, componentName, componentData = {}) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Cannot add component ${componentName} to non-existent entity ${entityId}`);
    }

    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }

    const factory = ComponentFactories[componentName];
    const data = factory ? factory(componentData) : { ...componentData };
    
    this.components.get(componentName).set(entityId, data);
    this.cacheDirty = true;
    return data;
  }

  removeComponent(entityId, componentName) {
    if (this.components.has(componentName)) {
      this.components.get(componentName).delete(entityId);
      this.cacheDirty = true;
    }
  }

  getComponent(entityId, componentName) {
    const entityMap = this.components.get(componentName);
    return entityMap ? entityMap.get(entityId) : undefined;
  }

  hasComponent(entityId, componentName) {
    const entityMap = this.components.get(componentName);
    return entityMap ? entityMap.has(entityId) : false;
  }

  /**
   * Queries for all entities that possess ALL the specified componentNames.
   * @param {string[]} componentNames
   * @returns {number[]} array of entity IDs
   */
  query(componentNames) {
    if (componentNames.length === 0) return [];

    // Simple cache key
    const cacheKey = componentNames.slice().sort().join(',');
    if (!this.cacheDirty && this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }

    // Clean dirty cache if it was dirty
    if (this.cacheDirty) {
      this.queryCache.clear();
      this.cacheDirty = false;
    }

    // Find smallest entity map among requested components
    let minComponentName = null;
    let minSize = Infinity;

    for (const name of componentNames) {
      const map = this.components.get(name);
      if (!map) {
        // One of the components does not exist in any entity
        this.queryCache.set(cacheKey, []);
        return [];
      }
      if (map.size < minSize) {
        minSize = map.size;
        minComponentName = name;
      }
    }

    const minMap = this.components.get(minComponentName);
    const results = [];

    // Filter entities of the smallest map by checking if they contain the rest of components
    for (const entityId of minMap.keys()) {
      let matchesAll = true;
      for (const name of componentNames) {
        if (name === minComponentName) continue;
        const otherMap = this.components.get(name);
        if (!otherMap || !otherMap.has(entityId)) {
          matchesAll = false;
          break;
        }
      }
      if (matchesAll) {
        results.push(entityId);
      }
    }

    this.queryCache.set(cacheKey, results);
    return results;
  }

  clear() {
    this.nextEntityId = 1;
    this.entities.clear();
    this.components.clear();
    this.queryCache.clear();
    this.cacheDirty = false;
  }
}
