import { Entity, THREE, registerComponent } from 'aframe';
import { Body, getBody } from './body';
import { fixSchema } from '../utils/schema';
import * as Vector from '../utils/vector';
const { Vector3, Quaternion } = THREE;

registerComponent('from-mesh', {
  schema: {},

  dependencies: ['body'],

  body: null as null | Body,

  init: async function () {
    this.data = fixSchema(this.data, this.schema as any);

    this.body = await getBody(this.el);
    if (this.body === null) {
      throw new Error('Cannot use "from mesh" without attached "body"');
    }
  },

  tick: function () {
    let matrix = meshMatrix(this.el);
    if (matrix === null) {
      return;
    }
    let { position, rotation, scale } = matrix;
    this.body?.setNextPosition(position);
    this.body?.setNextRotation(rotation);
  },
});

function meshMatrix(
  el: Entity
): { position: Vector.Vec3; rotation: Vector.Vec4; scale: Vector.Vec3 } | null {
  let mesh = el.getObject3D('mesh');
  if (mesh) {
    mesh.updateMatrixWorld();

    let position = new Vector3();
    let rotation = new Quaternion();
    let scale = new Vector3();

    mesh.matrixWorld.decompose(position, rotation, scale);

    return {
      position: Vector.fromVector3(position),
      rotation: Vector.fromVector4(rotation),
      scale: Vector.fromVector3(scale),
    };
  } else {
    return null;
  }
}
