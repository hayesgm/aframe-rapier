import { Entity, THREE, registerComponent } from 'aframe';
import { Body, getBody } from './body';
import { fixSchema } from '../utils/schema';
import * as Vector from '../utils/vector';
import { buildPromise } from '../utils/promise';
import { Object3D } from 'super-three';
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
    let { position, rotation, scale } = getMeshMatrix(this.el);
    this.body?.setNextPosition(position);
    this.body?.setNextRotation(rotation);
  },
});

interface MeshMatrix {
  position: Vector.Vec3;
  rotation: Vector.Vec4;
  scale: Vector.Vec3;
}

function meshMatrix(mesh: Object3D): MeshMatrix {
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
}
export function getMeshMatrix(el: Entity): MeshMatrix {
  return meshMatrix(el.object3D);
}

export async function waitForMeshMatrix(el: Entity): Promise<MeshMatrix> {
  let mesh = el.getObject3D('mesh');
  if (false) {
    return Promise.resolve(meshMatrix(mesh));
  } else {
    let [p, resolve, reject] = buildPromise<MeshMatrix>();
    setTimeout(() => {
      resolve(meshMatrix(el.getObject3D('mesh') ?? el.object3D));
    }, 1000);
    // el.addEventListener('loaded', function (evt: any) {
    //   console.log({evt});
      
    // });
    return p;
  }
}
