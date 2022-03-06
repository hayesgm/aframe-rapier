import { THREE, Entity, registerSystem } from 'aframe';
import {
  Collider,
  ColliderDesc,
  RigidBodyDesc,
  RigidBody,
  World,
  init as initRapier,
} from '@dimforge/rapier3d-compat';
import { Body, getBody } from '../components/body';
import { writeFile } from '../utils/file';
import { Schema, fixSchema } from '../utils/schema';

const { Quaternion } = THREE;

export interface RapierSystem {
  el: Entity;
  schema: Schema,
  rapier: Promise<Rapier>;
  data: {
    debug: boolean;
    paused: boolean;
  };
}

export class Rapier {
  world: World;
  debug: boolean;
  entities: Entity[];
  snapshot?: Uint8Array;
  paused: boolean;

  constructor(world: World, debug: boolean, paused: boolean) {
    this.world = world;
    this.debug = debug;
    this.entities = [];
    this.paused = paused;
  }

  registerEntity(entity: Entity) {
    this.entities.push(entity);
  }

  unregisterEntity(entity: Entity) {
    let index = this.entities.indexOf(entity);
    if (index === -1) {
      throw new Error('Unknown entity for removal');
    }
    this.entities.splice(index, 1);
  }

  generateRigidBody(desc: RigidBodyDesc): RigidBody {
    return this.world.createRigidBody(desc);
  }

  generateCollider(desc: ColliderDesc, body: Body): Collider {
    return this.world.createCollider(desc, body.rigidBody.handle);
  }

  step(delta: number) {
    if (!this.paused) {
      this.world.timestep = delta / 1000;
      this.world.step();
      for (let entity of this.entities) {
        let body = getBody(entity)!;
        // console.log(body.position());
        if (body && !body.isStatic) {
          let position = body.position();
          entity.object3D.position.set(position.x, position.y, position.z);
          let rotation = body.rotation();
          let q = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
          entity.object3D.rotation.setFromQuaternion(q);
        }
      }
    }
  }

  pause() {
    this.paused = true;
  }

  play() {
    this.paused = false;
  }

  togglePaused() {
    this.paused = !this.paused;
  }

  attachKeyEventListeners() {
    window.addEventListener('keydown', this.onKeyPress.bind(this));
  }

  removeKeyEventListeners() {
    window.removeEventListener('keydown', this.onKeyPress);
  }

  async onKeyPress(event: KeyboardEvent) {
    if (event.metaKey && String.fromCharCode(event.keyCode) === 'C') {
      event.preventDefault();
      event.stopPropagation();
      await this.captureSnapshot();
    } else if (event.metaKey && String.fromCharCode(event.keyCode) === 'V') {
      event.preventDefault();
      event.stopPropagation();
      if (this.snapshot) {
        await this.saveSnapshot();
      }
    } else if (event.metaKey && String.fromCharCode(event.keyCode) === 'S') {
      event.preventDefault();
      event.stopPropagation();
      await this.captureSnapshot();
      await this.saveSnapshot();
    } else if (!event.metaKey && String.fromCharCode(event.keyCode) === 'P') {
      event.preventDefault();
      event.stopPropagation();
      await this.togglePaused();
    }
  }

  async captureSnapshot() {
    this.snapshot = this.world.takeSnapshot();
    console.log('Snapshot', this.snapshot);
    console.log('Physics snapshot saved. Meta+V to save to disk');
  }

  async saveSnapshot() {
    let snapshot = this.snapshot;
    if (!snapshot) {
      throw new Error('Cannot save snapshot as none has been taken');
    }

    await writeFile(snapshot);
  }
}

export function getSystem(): RapierSystem {
  let scene = document.querySelector('a-scene');
  if (!scene) {
    throw new Error('Missing scene trying to initiate rapier-physics');
  }
  let res = scene.systems['rapier-physics'];
  if (!res) {
    throw new Error('Must initialize rapier-physics system on scene');
  }
  return res as unknown as RapierSystem;
}

export async function getRapier(): Promise<Rapier> {
  return await getSystem().rapier;
}

registerSystem('rapier-physics', {
  schema: { debug: { type: 'boolean' }, paused: { type: 'boolean' } },
  init: async function (this: RapierSystem) {
    this.data = fixSchema(this.data, this.schema);
    let resolve: (rapier: Rapier) => void;
    this.rapier = new Promise((resolve_) => (resolve = resolve_));
    console.log('initializing physics system');
    await initRapier();
    let gravity = { x: 0.0, y: -9.81, z: 0.0 }; // TODO: from data
    let world = new World(gravity);
    let rapier = new Rapier(world, this.data.debug, this.data.paused);
    rapier.attachKeyEventListeners();
    resolve!(rapier);
    console.log('physics system initialized');
  },

  remove: async function (this: RapierSystem) {
    (await this.rapier).removeKeyEventListeners();
  },

  tick: async function (this: RapierSystem, timestamp: number, delta: number) {
    let rapier = await this.rapier;
    rapier.step(delta);
  },

  pause: async function (this: RapierSystem) {
    (await this.rapier).pause();
  },

  play: async function (this: RapierSystem) {
    (await this.rapier).play();
  }
});
