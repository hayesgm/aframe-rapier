import { THREE } from 'aframe';
import { Box3 as ThreeBox3, Event, BufferGeometry, Object3D, Vector3 } from 'super-three';
import { Ball, Capsule, ColliderDesc, Cuboid } from '@dimforge/rapier3d-compat';

const {
  Box3,
  BoxBufferGeometry,
  CylinderGeometry,
  LineSegments,
  Matrix4,
  SphereGeometry,
  Quaternion,
  WireframeGeometry,
} = THREE;

export function getColliderObject(desc: ColliderDesc): {
  geometry: BufferGeometry;
  line: Object3D;
} {
  let geometry: BufferGeometry;
  if (desc.shape instanceof Cuboid) {
    geometry = new BoxBufferGeometry(
      desc.shape.halfExtents.x * 2,
      desc.shape.halfExtents.y * 2,
      desc.shape.halfExtents.z * 2
    );
  } else if (desc.shape instanceof Ball) {
    geometry = new SphereGeometry(desc.shape.radius, 20, 20);
  } else if (desc.shape instanceof Capsule) {
    geometry = new CylinderGeometry(
      desc.shape.radius,
      desc.shape.radius,
      desc.shape.halfHeight * 2
    );
  } else {
    throw new Error(`Cannot compute collider object for collider: ${desc}`);
  }
  geometry.applyQuaternion(new Quaternion(desc.rotation.w, desc.rotation.x, desc.rotation.y, desc.rotation.z));
  let translation = new Matrix4();
  translation.makeTranslation(desc.translation.x, desc.translation.y, desc.translation.z);
  geometry.applyMatrix4(translation);
  const wireframe = new WireframeGeometry(geometry);
  const line = new LineSegments(wireframe);
  return { geometry, line };
}

export function getBoundingBox(object3D: Object3D): ThreeBox3 {
  let boundingBox = new Box3();
  boundingBox.setFromObject(object3D, true);
  object3D.updateMatrixWorld();
  let inverted = new Matrix4().copy(object3D.matrixWorld).invert();
  boundingBox.applyMatrix4(inverted);
  return boundingBox;
}
