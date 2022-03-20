import { Entity, Schema, THREE, registerComponent } from 'aframe';
import { getRapier } from '../systems/rapier-system';
import { ImpulseJoint, JointData, RigidBody } from '@dimforge/rapier3d-compat';
import { Vec3, Vec4, fromVector3, toArray } from '../utils/vector';
import { Line as ThreeLine, Object3D, Quaternion } from 'super-three';
const { Matrix4, Vector3 } = THREE;
import { registerAsyncComponent } from '../async-component';
import { getBody } from './body';
import { getJointObject, updateJointObject } from '../utils/joint';

const schema: Schema<JointComponentData> = {
  type: { type: 'string', default: 'dynamic' },
  target: { type: 'selector' },
  anchor1: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
  anchor2: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
  frame1: { type: 'vec4', default: { x: 0, y: 0, z: 0, w: 1 } },
  frame2: { type: 'vec4', default: { x: 0, y: 0, z: 0, w: 1 } },
  axis: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
};

interface JointComponentData {
  type: string;
  target: Entity;
  anchor1: Vec3;
  anchor2: Vec3;
  frame1: Vec4;
  frame2: Vec4;
  axis: Vec3;
}

export class Joint {
  el: Entity;
  attrName: string;
  target: Entity;
  thisBody: RigidBody;
  targetBody: RigidBody;
  joint: ImpulseJoint;
  jointId: number;
  jointDesc: JointData;
  wireframe: ThreeLine | undefined;

  constructor(
    el: Entity,
    attrName: string,
    target: Entity,
    thisBody: RigidBody,
    targetBody: RigidBody,
    joint: ImpulseJoint,
    jointId: number,
    jointDesc: JointData
  ) {
    this.el = el;
    this.attrName = attrName;
    this.target = target;
    this.thisBody = thisBody;
    this.targetBody = targetBody;
    this.joint = joint;
    this.jointId = jointId;
    this.jointDesc = jointDesc;
  }

  static async initialize(el: Entity, data: JointComponentData, attrName: string): Promise<Joint> {
    console.log(data);
    let rapier = await getRapier();
    let thisBodyComp = await getBody(el);
    if (!thisBodyComp) {
      throw new Error(`Could not find body for element ${el}`);
    }
    let thisBody = thisBodyComp.rigidBody;
    let targetBodyComp = await getBody(data.target);
    if (!targetBodyComp) {
      throw new Error(`Could not find body for element ${data.target}`);
    }
    let targetBody = targetBodyComp.rigidBody;

    let jointDesc = getJointData(data);
    let jointId = rapier.world.impulseJoints.createJoint(
      rapier.world.bodies,
      jointDesc,
      thisBody.handle,
      targetBody.handle
    ); // TODO: Handle other joint types
    let joint = rapier.world.impulseJoints.get(jointId); // TODO: Handle other joint types
    // let joint = rapier.world.createImpulseJoint(jointDesc, thisBody, targetBody); // TODO: Handle other joint types
    // console.log("el joint", joint);

    return new Joint(el, attrName, data.target, thisBody, targetBody, joint, jointId, jointDesc);
  }

  async update(data: JointComponentData, oldData: JointComponentData) {
    // TODO: This is _weird_
    let rapier = await getRapier();
    if (rapier.debug) {
      this.wireframe = this.getWireframe(); // TODO: This shouldn't be on all updates
      this.el.sceneEl!.setObject3D(this.attrName, this.wireframe);
    }
  }

  async tick() {
    if (this.wireframe) {
      updateJointObject(this.wireframe, this.jointDesc, this.el.getObject3D('mesh'), this.target.getObject3D('mesh'));
    }
  }

  async remove() {
    let rapier = await getRapier();
    this.el.sceneEl!.removeObject3D(this.attrName);
    // console.log(this, this.joint)
    // rapier.world.removeImpulseJoint(this.joint);
    rapier.world.impulseJoints.remove(
      this.jointId,
      rapier.world.islands,
      rapier.world.bodies,
      true
    );
  }

  getWireframe(): ThreeLine {
    return getJointObject(this.jointDesc, this.el.getObject3D('mesh'), this.target.getObject3D('mesh'));
  }
}

export const getJoint = registerAsyncComponent<Joint, JointComponentData>(
  'joint',
  Joint.initialize,
  {
    schema,
    dependencies: ['body'],
  }
);

function getJointData(data: JointComponentData): JointData {
  console.log('data', data);
  switch (data.type) {
    case 'fixed':
      return JointData.fixed(data.anchor1, data.frame1, data.anchor2, data.frame2);
    case 'spherical':
      return JointData.spherical(data.anchor1, data.anchor2);
    case 'revolute':
      return JointData.revolute(data.anchor1, data.anchor2, data.axis);
    case 'prismatic':
      return JointData.prismatic(data.anchor1, data.anchor2, data.axis);
    default:
      throw new Error(`Unknown joint type: ${data.type}`);
  }
}
