import { Entity, THREE, registerComponent } from 'aframe';
import { RapierSystem, getRapier } from '../systems/rapier-system';
import { RigidBody, RigidBodyDesc, RigidBodyType } from '@dimforge/rapier3d-compat';
import { quaternionFromEuler } from '../utils/math';
import { Vec3, Vec4, fromVector3, toArray } from '../utils/vectors';
import { Schema, fixSchema } from '../utils/schema';
import { Quaternion } from 'super-three';
const { Vector3 } = THREE;

export class Body {
  entity: Entity;
  entityId: number;
  type: string;
  follow: boolean;
  rigidBody: RigidBody;
  rigidBodyDesc: RigidBodyDesc;
  nextPosition: Vec3 | undefined;

  constructor(entity: Entity, entityId: number, type: string, follow: boolean, rigidBody: RigidBody, rigidBodyDesc: RigidBodyDesc) {
    this.entity = entity;
    this.entityId = entityId;
    this.type = type;
    this.follow = follow;
    this.rigidBody = rigidBody;
    this.rigidBodyDesc = rigidBodyDesc;
  }

  position(): Vec3 {
    return this.rigidBody.translation();
  }

  getNextPosition(): Vec3 | undefined {
    return this.nextPosition;
  }

  setPosition(position: Vec3, wakeUp: boolean = true) {
    // console.log("setPosition", position, wakeUp);
    return this.rigidBody.setTranslation(position, wakeUp);
  }

  setNextPosition(position: Vec3) {
    this.nextPosition = position;
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
}

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

export interface BodyComponent {
  el: Entity;
  schema: Schema;
  system: RapierSystem;
  data: BodyComponentData;
  body: Body;
  bodyPromise: Promise<Body>;
}

registerComponent('body', {
  schema: {
    type: { type: 'string', default: 'dynamic' },
    follow: { type: 'boolean', default: true },
    linVel: { type: 'vec3' },
    angVel: { type: 'vec3' },
    linDamp: { type: 'number' },
    angDamp: { type: 'number' },
    gravityScale: { type: 'number', default: 1.0 },
    canSleep: { type: 'boolean', default: true },
    ccd: { type: 'boolean', default: false },
  },
  init: async function (this: BodyComponent) {
    this.data = fixSchema(this.data, this.schema);
    let bodyResolve: (body: Body) => void;
    this.bodyPromise = new Promise((resolve) => (bodyResolve = resolve));
    let rapier = await getRapier();
    let entityId = rapier.registerEntity(this.el);
    let position = this.el.getAttribute('position') as Vec3;
    let rotation = this.el.getAttribute('rotation');
    let rotationQuat = quaternionFromEuler(rotation);
    let bodyDesc = getBodyDesc(this.data)
      .setTranslation(position.x, position.y, position.z)
      .setRotation(rotationQuat)
      .setLinvel(...toArray(this.data.linVel))
      .setAngvel(this.data.angVel)
      .setLinearDamping(this.data.linDamp)
      .setAngularDamping(this.data.angDamp)
      .setGravityScale(this.data.gravityScale)
      .setCanSleep(this.data.canSleep)
      .setCcdEnabled(this.data.ccd);

    let body = rapier.generateRigidBody(bodyDesc, entityId);

    this.body = new Body(this.el, entityId, this.data.type, this.data.follow, body, bodyDesc);
    bodyResolve!(this.body);
  },

  update: async function (this: BodyComponent, oldData: BodyComponentData) {
    let body = await this.bodyPromise;

    if (this.data.type !== oldData.type) {
      body.setType(this.data.type);
    }
  },

  remove: async function (this: BodyComponent) {
    let rapier = await getRapier();
    rapier.unregisterEntity(this.body.entityId);
  },
});

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

export function getBodySync(el: Entity): Body | null {
  let bodyComponent = el.components['body'] as unknown as BodyComponent | undefined;
  if (bodyComponent) {
    return bodyComponent.body;
  } else {
    return null;
  }
}

export async function getBody(el: Entity): Promise<Body | null> {
  let bodyComponent = el.components['body'] as unknown as BodyComponent | undefined;
  if (bodyComponent) {
    return await bodyComponent.bodyPromise;
  } else {
    return null;
  }
}
