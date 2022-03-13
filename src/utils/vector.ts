import { Vector3, Vector4, Quaternion } from 'super-three';
import { THREE } from 'aframe';
const { Vector3: ThreeVector3, MathUtils } = THREE;

export type Vec3 = { x: number; y: number; z: number };
export type Vec4 = { x: number; y: number; z: number; w: number };

export function toVector3(vec: Vec3): Vector3 {
  return new ThreeVector3(vec.x, vec.y, vec.z);
}

export function fromVector3(vec: Vector3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

export function fromVector4(vec: Vector4 | Quaternion): Vec4 {
  return { x: vec.x, y: vec.y, z: vec.z, w: vec.w };
}

export function toArray(vec: Vec3): [number, number, number] {
  return [vec.x, vec.y, vec.z];
}

export function toRadArray(vec: Vec3): [number, number, number] {
  return toArray(vec).map((d) => MathUtils.degToRad(d)) as [number, number, number];
}

export function vecLen(vec3: Vec3): number {
  return Math.sqrt(vec3.x * vec3.x + vec3.y * vec3.y + vec3.z * vec3.z);
}

export function mulScalar(vec3: Vec3, scale: number): Vec3 {
  return { x: vec3.x * scale, y: vec3.y * scale, z: vec3.z * scale };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
