import { THREE } from 'aframe';
import { Euler, Quaternion as Quat } from 'super-three';
import { Vec3, toRadArray } from './vectors';

const { Quaternion } = THREE;

export function quaternionFromEuler(rotation: Vec3): Quat {
  const quaternion = new Quaternion();
  const euler = new Euler(...toRadArray(rotation), 'XYZ');
  quaternion.setFromEuler(euler);
  return quaternion;
}
