import { Entity, registerComponent } from 'aframe';
import { RapierSystem, getRapier } from '../systems/rapier-system';
import { RigidBody, RigidBodyDesc, RigidBodyType } from '@dimforge/rapier3d-compat';
import { quaternionFromEuler } from '../utils/math';
import { Vec3, Vec4, toArray } from '../utils/vectors';
import { Schema, fixSchema } from '../utils/schema';

export class Body {
  isStatic: boolean;
  rigidBody: RigidBody;
  rigidBodyDesc: RigidBodyDesc;

  constructor(isStatic: boolean, rigidBody: RigidBody, rigidBodyDesc: RigidBodyDesc) {
    this.isStatic = isStatic;
    this.rigidBody = rigidBody;
    this.rigidBodyDesc = rigidBodyDesc;
  }

  position(): Vec3 {
    return this.rigidBody.translation();
  }

  rotation(): Vec4 {
    return this.rigidBody.rotation();
  }
}

interface BodyComponentData {
  static: boolean;
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
}

registerComponent('body', {
  schema: {
    static: { type: 'boolean', default: false },
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
    let rapier = await getRapier();
    rapier.registerEntity(this.el);
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

    let body = rapier.generateRigidBody(bodyDesc);

    this.body = new Body(this.data.static, body, bodyDesc);
  },

  remove: async function (this: BodyComponent) {
    let rapier = await getRapier();
    rapier.unregisterEntity(this.el);
  },
});

function getBodyDesc(data: BodyComponentData): RigidBodyDesc {
  return new RigidBodyDesc(data.static ? RigidBodyType.Static : RigidBodyType.Dynamic);
}

export function getBody(el: Entity): Body | null {
  let bodyComponent = el.components['body'] as unknown as BodyComponent | undefined;
  if (bodyComponent) {
    return bodyComponent.body;
  } else {
    return null;
  }
}
