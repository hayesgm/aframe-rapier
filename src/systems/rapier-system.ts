import { THREE, Entity, registerSystem } from 'aframe';
import {
  Collider,
  ColliderDesc,
  EventQueue,
  RigidBodyDesc,
  RigidBody,
  World,
  init as initRapier,
} from '@dimforge/rapier3d-compat';
import { Body, getBody } from '../components/body';
import { writeFile } from '../utils/file';
import { fixSchema } from '../utils/schema';
import { Vec3, Vec4, vecLen } from '../utils/vector';
import { tdebug } from '../utils/debug';
import { Quaternion as ThreeQuaternion } from 'super-three';
import { registerAsyncSystem } from '../async-system';

const { Matrix4, Vector3, Quaternion } = THREE;

interface CustomEventMap {
  collide: CustomEvent<CollisionEvent>;
}

declare global {
  interface Document {
    //adds definition to Document, but you can do the same with HTMLElement
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void
    ): void;
  }
}

export interface CollisionEvent {
  collidingEntity: Entity;
  selfCollider: number;
  otherCollider: number;
}

export interface RapierSystemData {
    debug: boolean;
    paused: boolean;
    autoSnap: number;
};

export class Rapier {
  world: World;
  debug: boolean;
  nextEntityId: number;
  entities: Map<number, Entity>;
  snapshot?: Uint8Array;
  snapshotTimestamp?: number;
  paused: boolean;
  autoSnap: number;
  bodyMap: Map<number, number>;
  colliderMap: Map<number, number>;

  constructor(world: World, debug: boolean, paused: boolean, autoSnap: number) {
    this.world = world;
    this.debug = debug;
    this.nextEntityId = 0;
    this.entities = new Map();
    this.paused = paused;
    this.autoSnap = autoSnap;
    this.bodyMap = new Map();
    this.colliderMap = new Map();

    this.attachKeyEventListeners();
  }

  static async initialize(el: Entity, data: RapierSystemData): Promise<Rapier> {
    console.log('initializing physics system');
    await initRapier();
    console.log('physics system initialized');
    let gravity = { x: 0.0, y: -9.81, z: 0.0 }; // TODO: from data
    let world = new World(gravity);
    return new Rapier(world, data.debug, data.paused, data.autoSnap);
  }

  registerEntity(entity: Entity): number {
    let entityId = this.nextEntityId++;
    this.entities.set(entityId, entity);
    return entityId;
  }

  unregisterEntity(entityId: number) {
    this.entities.delete(entityId);
  }

  generateRigidBody(desc: RigidBodyDesc, entityId: number): RigidBody {
    let rigidBody = this.world.createRigidBody(desc);
    this.bodyMap.set(rigidBody.handle, entityId);
    return rigidBody;
  }

  generateCollider(desc: ColliderDesc, body: Body): Collider {
    let collider = this.world.createCollider(desc, body.rigidBody.handle);
    this.colliderMap.set(collider.handle, body.rigidBody.handle);
    return collider;
  }

  autoSnapshot(timestamp: number) {
    if (this.autoSnap !== 0) {
      if (
        this.snapshotTimestamp === undefined ||
        timestamp - this.snapshotTimestamp > this.autoSnap
      ) {
        this.snapshot = this.world.takeSnapshot();
        this.snapshotTimestamp = timestamp;
      }
    }
  }

  getEntityById(entityId: number): Entity | null {
    return this.entities.get(entityId) ?? null;
  }

  getEntityByCollider(colliderHandle: number): Entity | null {
    let bodyHandle = this.colliderMap.get(colliderHandle);
    if (bodyHandle === undefined) {
      return null;
    }
    let entityId = this.bodyMap.get(bodyHandle);
    if (entityId === undefined) {
      return null;
    }
    return this.getEntityById(entityId);
  }

  async step(timestamp: number, delta: number) {
    this.autoSnapshot(timestamp);

    if (!this.paused) {
      // this.world.timestep = delta / 1000;
      let eventQueue = new EventQueue(true);

      try {
        this.world.step(eventQueue);
      } catch (e) {
        console.error('Physics Error: ', e);
        if (this.snapshotTimestamp) {
          console.log(
            `Last auto snapshot saved ${Math.round(
              timestamp - this.snapshotTimestamp
            )}ms ago. Ctrl+V to save to disk`
          );
        }

        this.paused = true;
        throw e;
      }

      eventQueue.drainIntersectionEvents((colliderHandle1: number, colliderHandle2: number, intersecting: boolean) => {
        let entity1 = this.getEntityByCollider(colliderHandle1);
        let entity2 = this.getEntityByCollider(colliderHandle2);

        if (entity1 === null || entity2 === null) {
          return;
        }

        let event = intersecting ? 'collide' : 'separate';
        entity1.dispatchEvent(
          new CustomEvent<CollisionEvent>(event, {
            detail: {
              collidingEntity: entity2,
              selfCollider: colliderHandle1,
              otherCollider: colliderHandle2,
            },
          })
        );

        entity2.dispatchEvent(
          new CustomEvent<CollisionEvent>(event, {
            detail: {
              collidingEntity: entity1,
              selfCollider: colliderHandle2,
              otherCollider: colliderHandle1,
            },
          })
        );
      });

      for (let [entityId, entity] of this.entities) {
        let body = await getBody(entity)!;

        if (body) {
          let position: Vec3 | undefined;
          let rotation: Vec4 | undefined;

          if (body.isStatic()) {
            // Skip
          } else if (body.isDynamic()) {
            position = body.position();
            rotation = body.rotation();
          } else if (body.isPositionBased()) {
            position = body.nextPosition;
            if (position !== undefined) {
              body.setPosition(position);
            }
            rotation = body.nextRotation;
            if (rotation !== undefined) {
              body.setRotation(rotation);
            }
          } else {
            throw new Error(`Unknown body type: ${body.type}`);
          }

          if (body.follow) {
            let parent = entity.object3D.parent;
            let inverseParentPosition = new Vector3();
            let inverseParentRotation = new Quaternion();
            let inverseParentScale = new Vector3();

            if (false) {
              parent!.updateMatrixWorld();
              let inverseParent = new Matrix4();
              inverseParent.copy(parent!.matrixWorld);
              inverseParent.invert();
              inverseParent.decompose(inverseParentPosition, inverseParentRotation, inverseParentScale);
            }

            if (position) {              
              let positionVec = new Vector3(position.x, position.y, position.z);
              positionVec.add(inverseParentPosition);
              entity.object3D.position.set(positionVec.x, positionVec.y, positionVec.z);
            }

            if (rotation) {
              let q = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
              q.multiply(inverseParentRotation);
              entity.object3D.rotation.setFromQuaternion(q);
            }
          }
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

  remove() {
    this.removeKeyEventListeners();
  }

  tick(timestamp: number, delta: number) {
    this.step(timestamp, delta);
  }
}

export const getRapier = registerAsyncSystem('rapier-physics', Rapier.initialize, {
  schema: {
    debug: { type: 'boolean' },
    paused: { type: 'boolean' },
    autoSnap: { type: 'number', default: 0 },
  },
});
