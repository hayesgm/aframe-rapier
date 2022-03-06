import { Vector3 } from 'super-three';
import { THREE } from 'aframe';
const { Vector3: ThreeVector3, MathUtils } = THREE;

export type Vec3 = { x: number; y: number; z: number };
export type Vec4 = { x: number; y: number; z: number; w: number };

export function toVector3(vec: Vec3): Vector3 {
  return new ThreeVector3(vec.x, vec.y, vec.z);
}

export function toArray(vec: Vec3): [number, number, number] {
  return [vec.x, vec.y, vec.z];
}

export function toRadArray(vec: Vec3): [number, number, number] {
  return toArray(vec).map((d) => MathUtils.degToRad(d)) as [number, number, number];
}
