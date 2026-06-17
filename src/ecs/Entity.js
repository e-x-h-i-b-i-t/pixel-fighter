export class Entity {
  constructor(world, id = null) {
    this.world = world;
    this.id = id !== null ? id : world.createEntity();
  }

  addComponent(componentName, componentData = {}) {
    this.world.addComponent(this.id, componentName, componentData);
    return this;
  }

  removeComponent(componentName) {
    this.world.removeComponent(this.id, componentName);
    return this;
  }

  getComponent(componentName) {
    return this.world.getComponent(this.id, componentName);
  }

  hasComponent(componentName) {
    return this.world.hasComponent(this.id, componentName);
  }

  destroy() {
    this.world.destroyEntity(this.id);
  }
}
