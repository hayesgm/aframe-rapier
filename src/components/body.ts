import { Entity, Schema, THREE, registerComponent } from 'aframe';
import { getRapier } from '../systems/rapier-system';
import { RigidBody, RigidBodyDesc, RigidBodyType } from '@dimforge/rapier3d-compat';
import { quaternionFromEuler } from '../utils/math';
import { Vec3, Vec4, fromVector3, toArray } from '../utils/vector';
import { Quaternion } from 'super-three';
const { Vector3 } = THREE;
import { registerAsyncComponent } from '../async-component';
import { waitForMeshMatrix } from './from-mesh';

const schema: Schema<BodyComponentData> = {
  type: { type: 'string', default: 'dynamic' },
  follow: { type: 'boolean', default: true },
  linVel: { type: 'vec3' },
  angVel: { type: 'vec3' },
  linDamp: { type: 'number' },
  angDamp: { type: 'number' },
  gravityScale: { type: 'number', default: 1.0 },
  canSleep: { type: 'boolean', default: true },
  ccd: { type: 'boolean', default: false },
};

interface BodyComponentData {
  type: string;
  follow: boolean;
  linVel: Vec3;
  angVel: Vec3;
  linDamp: number;
  angDamp: number;
  gravityScale: number;
  canSleep: boolean;
  ccd: boolean;
}

export class Body {
  el: Entity;
  entityId: number;
  type: string;
  follow: boolean;
  rigidBody: RigidBody;
  rigidBodyDesc: RigidBodyDesc;
  nextPosition: Vec3 | undefined;
  nextRotation: Vec4 | undefined;

  constructor(el: Entity, entityId: number, type: string, follow: boolean, rigidBody: RigidBody, rigidBodyDesc: RigidBodyDesc) {
    this.el = el;
    this.entityId = entityId;
    this.type = type;
    this.follow = follow;
    this.rigidBody = rigidBody;
    this.rigidBodyDesc = rigidBodyDesc;
  }

  static async initialize(el: Entity, data: BodyComponentData): Promise<Body> {
    let rapier = await getRapier();
    let entityId = rapier.registerEntity(el);
    let { position, rotation } = await waitForMeshMatrix(el);
    console.log(el.id, "canSleep", data.canSleep);
    let bodyDesc = getBodyDesc(data)
      .setTranslation(position.x, position.y, position.z)
      .setRotation(rotation)
      .setLinvel(...toArray(data.linVel))
      .setAngvel(data.angVel)
      .setLinearDamping(data.linDamp)
      .setAngularDamping(data.angDamp)
      .setGravityScale(data.gravityScale)
      .setCanSleep(data.canSleep)
      .setCcdEnabled(data.ccd);

    let body = rapier.generateRigidBody(bodyDesc, entityId);

    return new Body(el, entityId, data.type, data.follow, body, bodyDesc);
  }

  position(): Vec3 {
    return this.rigidBody.translation();
  }

  setPosition(position: Vec3, wakeUp: boolean = true) {
    return this.rigidBody.setTranslation(position, wakeUp);
  }

  setRotation(rotation: Vec4, wakeUp: boolean = true) {
    return this.rigidBody.setRotation(rotation, wakeUp);
  }

  setNextPosition(position: Vec3) {
    this.nextPosition = position;
  }

  setNextRotation(rotation: Vec4) {
    this.nextRotation = rotation;
  }

  setType(type: string) {
    this.type = type;
  }

  rotation(): Vec4 {
    return this.rigidBody.rotation();
  }

  isStatic(): boolean {
    return this.type === 'static';
  }

  isDynamic(): boolean {
    return this.type === 'dynamic';
  }

  isPositionBased(): boolean {
    return this.type === 'position';
  }

  applyImpulse(impulse: Vec3, wakeUp: boolean = true) {
    this.rigidBody.applyImpulse(impulse, wakeUp);
  }

  async update(data: BodyComponentData, oldData: BodyComponentData) {
    // console.log([this.el.id, this.data.type, oldData.type]);
    if (data.type !== oldData.type) {
      this.setType(data.type);
    }
  }

  async remove() {
    let rapier = await getRapier();
    rapier.unregisterEntity(this.entityId);
  }
}

export const getBody = registerAsyncComponent<Body, BodyComponentData>('body', Body.initialize, { schema, dependencies: [] });

function getBodyDesc(data: BodyComponentData): RigidBodyDesc {
  return new RigidBodyDesc(getBodyType(data.type));
}

function getBodyType(type: string): RigidBodyType {
  switch (type) {
    case 'dynamic':
      return RigidBodyType.Dynamic;
    case 'static': 
      return RigidBodyType.Static;
    case 'position':
      return RigidBodyType.KinematicPositionBased;
    case 'velocity':
      return RigidBodyType.KinematicVelocityBased;
    default:
      throw new Error(`Unknown rigid body type: ${type}`);
  }
}
