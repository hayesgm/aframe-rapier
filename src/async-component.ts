import { Component, ComponentDefinition, Entity, Schema, registerComponent } from 'aframe';
import { Camera } from 'super-three';
import { fixSchema } from './utils/schema';

export interface AsyncComponent<T extends PartialComponent<D>, D extends object> extends Component<D> {
  component: Promise<T>
};

export type PartialComponent<D extends object> =
  Omit<Partial<Component<D>>, 'update'> & { update?: (newData: D, oldData: D) => void };

export type PartialComponentDefinition<D extends object> =
  Omit<Partial<ComponentDefinition<D>>, 'schema'> & { schema: Schema<D> }

export function registerAsyncComponent<T extends PartialComponent<D>, D extends object>(name: string, initializer: (el: Entity, data: D, attrName: string) => Promise<T>, def: PartialComponentDefinition<D>): ((el: Entity) => Promise<T | null>) {
  registerComponent(name, {
    ...def,
    init: async function(this: AsyncComponent<T, D>) {
      let data: D = fixSchema<D>(this.data, def.schema);
      this.component = initializer(this.el, data, this.attrName!);
    },

    pause: async function(this: AsyncComponent<T, D>) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.pause) === 'function') {
        component.pause();
      }
      if (typeof(def.pause) === 'function') {
        def.pause.call(component);
      }
    },

    play: async function(this: AsyncComponent<T, D>) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.play) === 'function') {
        component.play();
      }
      if (typeof(def.play) === 'function') {
        def.play.call(component);
      }
    },

    remove: async function(this: AsyncComponent<T, D>) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.remove) === 'function') {
        component.remove();
      }
      if (typeof(def.remove) === 'function') {
        def.remove.call(component);
      }
    },

    tick: async function(this: AsyncComponent<T, D>, time: number, timeDelta: number) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.tick) === 'function') {
        component.tick(time, timeDelta);
      }
      if (typeof(def.tick) === 'function') {
        def.tick.call(component, time, timeDelta);
      }
    },

    tock: async function(this: AsyncComponent<T, D>, time: number, timeDelta: number, camera: Camera) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.tock) === 'function') {
        component.tock(time, timeDelta, camera);
      }
      if (typeof(def.tock) === 'function') {
        def.tock.call(component, time, timeDelta, camera);
      }
    },

    update: async function(this: AsyncComponent<T, D>, oldData: D) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.update) === 'function') {
        component.update(this.data, oldData);
      }
      if (typeof(def.update) === 'function') {
        def.update.call(component, oldData);
      }
    },

    updateSchema: async function(this: AsyncComponent<T, D>) {
      if (this.component === undefined) {
        return;
      }
      let component = await this.component;
      if (typeof(component.updateSchema) === 'function') {
        component.updateSchema();
      }
      if (typeof(def.updateSchema) === 'function') {
        def.updateSchema.call(component);
      }
    },
  });

  return async function getComponent(el: Entity, required: boolean = false): Promise<T | null> {
    let component = el.components[name];
    if (component === undefined) {
      return null;
    }
    return await (component as AsyncComponent<T, D>).component;
  }
}
