import { THREE } from 'aframe';
import { Box3 as ThreeBox3, Line as ThreeLine, Event, Object3D } from 'super-three';
import { Ball, Capsule, JointData, JointType, Cuboid } from '@dimforge/rapier3d-compat';
const { BufferGeometry, Line, LineBasicMaterial, Vector3 } = THREE;
import { toVector3 } from './vector';

export function getJointObject(desc: JointData, object1: Object3D, object2: Object3D): ThreeLine {
  const material = new LineBasicMaterial({
    color: 0xbb4400,
  });

  // TODO: Add support for frame/axis
  // switch (desc.jointType) {
  //   case JointData.fixed:

  // }

  const points = [];
  let pos1 = new Vector3();
  let pos2 = new Vector3();
  object1.updateMatrixWorld();
  object2.updateMatrixWorld();
  object1.getWorldPosition(pos1);
  object2.getWorldPosition(pos2);
  pos1.add(toVector3(desc.anchor1));
  pos2.add(toVector3(desc.anchor2));
  console.log("joint object", pos1, pos2);
  points.push(pos1);
  points.push(pos2);

  const geometry = new BufferGeometry().setFromPoints(points);

  return new Line(geometry, material);
}

export function updateJointObject(line: ThreeLine, desc: JointData, object1: Object3D, object2: Object3D) {
  let pos1 = new Vector3();
  let pos2 = new Vector3();
  object1.updateMatrixWorld();
  object2.updateMatrixWorld();
  object1.getWorldPosition(pos1);
  object2.getWorldPosition(pos2);
  pos1.add(toVector3(desc.anchor1));
  pos2.add(toVector3(desc.anchor2));
  //console.log("update", pos1, pos2);
  line.geometry.attributes.position.setXYZ(0, pos1.x, pos1.y, pos1.z);
  line.geometry.attributes.position.setXYZ(1, pos2.x, pos2.y, pos2.z);
  line.geometry.attributes.position.needsUpdate = true;
}
