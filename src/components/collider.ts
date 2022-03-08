import { THREE, Entity, registerComponent } from 'aframe';
import { RapierSystem, getRapier } from '../systems/rapier-system';
import {
  ActiveCollisionTypes,
  ActiveEvents,
  CoefficientCombineRule,
  Collider as RapierCollider,
  ColliderDesc,
} from '@dimforge/rapier3d-compat';
import { Group, Object3D } from 'three';
import { getBoundingBox, getColliderObject } from '../utils/bounds';
import { getBody } from './body';
import { Vec3, toVector3, vecLen } from '../utils/vectors';
import { Schema, fixSchema } from '../utils/schema';
import { Vector3 as ThreeVector3 } from 'super-three';
const { Matrix4, Vector3 } = THREE;

class Collider {
  collider: RapierCollider;
  colliderDesc: ColliderDesc;

  constructor(collider: RapierCollider, colliderDesc: ColliderDesc) {
    this.collider = collider;
    this.colliderDesc = colliderDesc;
  }

  wireframe(): Object3D {
    let { geometry, line } = getColliderObject(this.colliderDesc);
    return line;
  }
}

interface ColliderComponentData {
  shape: string;
  wrap: boolean;
  size: Vec3;
  translation: Vec3;
  density: number;
  friction: number;
  restitution: number;
  restitutionCombineRule: string;
  sensor: boolean;
}

export interface ColliderComponent {
  attrName: string;
  el: Entity;
  schema: Schema;
  system: RapierSystem;
  collider: Collider;
  colliderPromise: Promise<Collider>;
  data: ColliderComponentData;
}

registerComponent('collider', {
  multiple: true,
  dependencies: ['body'],
  schema: {
    shape: { type: 'string', default: 'box', cat: 1 },
    wrap: { type: 'boolean', default: true },
    size: { type: 'vec3' },
    translation: { type: 'vec3' },
    density: { type: 'number', default: 1.0 },
    friction: { type: 'number', default: 1.0 },
    restitution: { type: 'number', default: 0 },
    restitutionCombineRule: { type: 'string', default: 'average' },
    sensor: { type: 'boolean' },
  },
  init: async function (this: ColliderComponent) {
    console.log('initialing collider', this);
    let resolve: (collider: Collider) => void;
    this.colliderPromise = new Promise((resolve_) => (resolve = resolve_));
    let rapier = await getRapier();
    this.data = fixSchema(this.data, this.schema);

    let body = await getBody(this.el);
    if (body === null) {
      throw new Error('Must attach "body" to attach "collider" component');
    }
    // TODO: Bypass if not auto-model
    let buildCollider = () => {
      let object3D = this.el.getObject3D('mesh'); // TODO: This needs to be only if model
      let scale: any = this.el.getAttribute('scale') as Vec3;
      let colliderDesc = getColliderDesc(this.data, object3D, scale);
      let collider = rapier.generateCollider(colliderDesc, body!);

      let colliderObject = new Collider(collider, colliderDesc);
      this.collider = colliderObject;
      resolve(colliderObject);
    };
    if (!this.data.wrap || this.el.getObject3D('mesh') !== undefined) {
      buildCollider();
    } else {
      this.el.addEventListener('model-loaded', buildCollider.bind(this));
    }
  },

  update: async function (this: ColliderComponent) {
    let rapier = await getRapier();
    if (rapier.debug) {
      let collider = await this.colliderPromise;
      console.log({collider});
      let wireframe = collider.wireframe();
      // Apply scale up, wonder if there's an easier way to handle this all....
      // Notes: we applied a scale-down for the physics system, but it's being _reapplied_ to this geometry
      // So we are sclaing this back up so it's the correct size when that scale is applied.
      let scale: any = this.el.getAttribute('scale') as Vec3;
      wireframe.applyMatrix4(new Matrix4().makeScale(1 / scale.x, 1 / scale.y, 1 / scale.z));
      this.el.setObject3D(this.attrName, wireframe);
    }
  },

  remove: async function (this: ColliderComponent) {
    let rapier = await getRapier();
    this.el.removeObject3D(this.attrName);
  },
});

function getColliderDesc(
  data: ColliderComponentData,
  object3D: Object3D,
  scale: Vec3
): ColliderDesc {
  let size: ThreeVector3;
  let translation: ThreeVector3;

  if (data.wrap) {
    let boundingBox = getBoundingBox(object3D);

    // Notes: we're computing the local bounding box (by inverting the world transform), but
    // this leaves us with an issue: the local object is _huge_ and being scaled down when it's placed in the world.
    // So instead of saying this collider is the size of a skyscraper in the Physics system, we instead scale it down.
    // We don't need to move it or rotate it because the rigid body is moved and rotated, actually.
    boundingBox.applyMatrix4(new Matrix4().makeScale(scale.x, scale.y, scale.z));

    let center = new Vector3();
    boundingBox.getCenter(center);
    size = new Vector3();
    boundingBox.getSize(size);
    translation = center.sub(object3D.position);
  } else {
    size = toVector3(data.size);
    let sizeLen = size.length();
    if (sizeLen === 0) {
      throw new Error('Collider: `size` required if `wrap` is not set.');
    }
    translation = toVector3(data.translation);
  }
  console.log({ shape: data.shape, size, translation });

  let collider;
  if (data.shape === 'box') {
    // console.log({ shape: 'box', size, center, translation });
    collider = ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
  } else if (data.shape === 'ball') {
    // console.log({ shape: 'ball', size, center, l: size.length(), translation });
    collider = ColliderDesc.ball(size.length() / 2);
  } else {
    throw new Error(`Unknown shape: '${data.shape}'`);
  }

  return collider
    .setTranslation(translation.x, translation.y, translation.z)
    .setDensity(data.density)
    .setFriction(data.friction)
    .setRestitution(data.restitution)
    .setRestitutionCombineRule(getRestitutionCombineRule(data.restitutionCombineRule))
    .setActiveCollisionTypes(ActiveCollisionTypes.DEFAULT |  ActiveCollisionTypes.KINEMATIC_STATIC)
    .setActiveEvents(ActiveEvents.INTERSECTION_EVENTS)
    .setSensor(data.sensor);
}

function getRestitutionCombineRule(rule: string): CoefficientCombineRule {
  switch (rule) {
    case 'average':
      return CoefficientCombineRule.Average;
    case 'min':
      return CoefficientCombineRule.Min;
    case 'multiply':
      return CoefficientCombineRule.Multiply;
    case 'max':
      return CoefficientCombineRule.Max;
    default:
      throw new Error(`Unknown restitution combine rule: ${rule}`);
  }
}
