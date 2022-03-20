import { THREE, Schema, Entity, registerComponent } from 'aframe';
import { getRapier } from '../systems/rapier-system';
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
import { Vec3, toVector3, vecLen } from '../utils/vector';
import { fixSchema } from '../utils/schema';
import { Vector3 as ThreeVector3 } from 'super-three';
const { Matrix4, Vector3 } = THREE;
import { registerAsyncComponent } from '../async-component';
import { buildPromise } from '../utils/promise';

const schema: Schema<ColliderComponentData> = {
  shape: { type: 'string', default: 'box' },
  wrap: { type: 'boolean', default: true },
  size: { type: 'vec3' },
  translation: { type: 'vec3' },
  density: { type: 'number', default: 1.0 },
  friction: { type: 'number', default: 1.0 },
  restitution: { type: 'number', default: 0 },
  restitutionCombineRule: { type: 'string', default: 'average' },
  sensor: { type: 'boolean' },
  collisionGroups: { type: 'number', default: 0xffffffff },
};

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
  collisionGroups: number;
}

class Collider {
  el: Entity;
  attrName: string;
  collider: RapierCollider;
  colliderDesc: ColliderDesc;

  constructor(el: Entity, attrName: string, collider: RapierCollider, colliderDesc: ColliderDesc) {
    this.el = el;
    this.attrName = attrName;
    this.collider = collider;
    this.colliderDesc = colliderDesc;
  }

  static async initialize(
    el: Entity,
    data: ColliderComponentData,
    attrName: string
  ): Promise<Collider> {
    let [p, resolve, reject] = buildPromise<Collider>();
    let rapier = await getRapier();

    let body = await getBody(el);
    if (body === null) {
      throw new Error('Must attach "body" to attach "collider" component');
    }

    let buildCollider = () => {
      let object3D = el.getObject3D('mesh'); // TODO: This needs to be only if model
      let scale: any = el.getAttribute('scale') as Vec3;
      let colliderDesc = getColliderDesc(data, object3D, scale);
      let collider = rapier.generateCollider(colliderDesc, body!);

      resolve(new Collider(el, attrName, collider, colliderDesc));
    };

    if (!data.wrap || el.getObject3D('mesh') !== undefined) {
      // Bypass if not wrap or model already loaded
      buildCollider();
    } else {
      el.addEventListener('model-loaded', buildCollider.bind(this));
    }

    return p;
  }

  wireframe(): Object3D {
    let { geometry, line } = getColliderObject(this.colliderDesc);
    return line;
  }

  async update(data: ColliderComponentData, oldData: ColliderComponentData) {
    if (data.sensor !== oldData.sensor) {
      this.collider.setSensor(data.sensor);
      this.colliderDesc.setSensor(data.sensor);
    }

    if (data.collisionGroups !== oldData.collisionGroups) {
      this.collider.setCollisionGroups(data.collisionGroups);
    }

    // TODO: This is _weird_
    let rapier = await getRapier();
    if (rapier.debug) {
      let wireframe = this.wireframe();
      // Apply scale up, wonder if there's an easier way to handle this all....
      // Notes: we applied a scale-down for the physics system, but it's being _reapplied_ to this geometry
      // So we are sclaing this back up so it's the correct size when that scale is applied.
      let scale: any = this.el.getAttribute('scale') as Vec3;
      wireframe.applyMatrix4(new Matrix4().makeScale(1 / scale.x, 1 / scale.y, 1 / scale.z));
      this.el.setObject3D(this.attrName, wireframe);
    }
  }

  async remove() {
    let rapier = await getRapier();
    this.el.removeObject3D(this.attrName);
  }
}

export const getCollider = registerAsyncComponent('collider', Collider.initialize, {
  schema,
  multiple: true,
  dependencies: ['body'],
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
  // console.log({ shape: data.shape, size, translation });

  let collider;
  if (data.shape === 'box') {
    // console.log({ shape: 'box', size, center, translation });
    collider = ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
  } else if (data.shape === 'ball') {
    // console.log({ shape: 'ball', size, center, l: size.length(), translation });
    // Why is this off by 50%?
    collider = ColliderDesc.ball(size.length() / 3);
  } else {
    throw new Error(`Unknown shape: '${data.shape}'`);
  }

  return collider
    .setTranslation(translation.x, translation.y, translation.z)
    .setDensity(data.density)
    .setFriction(data.friction)
    .setRestitution(data.restitution)
    .setRestitutionCombineRule(getRestitutionCombineRule(data.restitutionCombineRule))
    .setActiveCollisionTypes(ActiveCollisionTypes.DEFAULT | ActiveCollisionTypes.KINEMATIC_STATIC)
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
