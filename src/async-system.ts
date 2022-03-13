import { System, SystemDefinition, Entity, Schema, registerSystem } from 'aframe';
import { Camera } from 'super-three';
import { fixSchema } from './utils/schema';

export interface AsyncSystem<T extends PartialSystem<D>, D extends object> extends System<D> {
  system: Promise<T>
};

export type PartialSystem<D extends object> =
  Partial<System<D>>

export type PartialSystemDefinition<D extends object> =
  Omit<Partial<SystemDefinition<D>>, 'schema'> & { schema: Schema<D> }

export function registerAsyncSystem<T extends PartialSystem<D>, D extends object>(name: string, initializer: (el: Entity, data: D) => Promise<T>, def: PartialSystemDefinition<D>): (() => Promise<T>) {
  registerSystem(name, {
    ...def,
    init: async function(this: AsyncSystem<T, D>) {
      let data: D = fixSchema<D>(this.data, def.schema);
      this.system = initializer(this.el, data);
    },

    pause: async function(this: AsyncSystem<T, D>) {
      if (this.system === undefined) {
        return;
      }
      let component = await this.system;
      if (typeof(component.pause) === 'function') {
        component.pause();
      }
      if (typeof(def.pause) === 'function') {
        def.pause.call(component);
      }
    },

    play: async function(this: AsyncSystem<T, D>) {
      if (this.system === undefined) {
        return;
      }
      let component = await this.system;
      if (typeof(component.play) === 'function') {
        component.play();
      }
      if (typeof(def.play) === 'function') {
        def.play.call(component);
      }
    },

    tick: async function(this: AsyncSystem<T, D>, time: number, timeDelta: number) {
      if (this.system === undefined) {
        return;
      }
      let component = await this.system;
      if (typeof(component.tick) === 'function') {
        component.tick(time, timeDelta);
      }
      if (typeof(def.tick) === 'function') {
        def.tick.call(component, time, timeDelta);
      }
    },
  });

  return async function getSystem(required: boolean = false): Promise<T> {
    let scene = document.querySelector('a-scene');
    if (!scene) {
      throw new Error('Missing scene element');
    }
    let res = scene.systems[name];
    if (!res) {
      throw new Error(`Must initialize ${name} system on scene`);
    }
    return (await res as AsyncSystem<T, D>).system;
  }
}
