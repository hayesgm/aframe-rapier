import { registerComponent } from 'aframe';
import { getRapier } from '../systems/rapier-system';
import { fixSchema } from '../utils/schema';
import { Vec3, Vec4, fromVector3, toArray, add } from '../utils/vector';
import { Body, getBody } from './body';
import { tdebug } from '../utils/debug';

registerComponent('track', {
  schema: {
    body: { type: 'selector' },
    relative: { type: 'vec3' },
  },

  depedencies: ['body'],

  selfBody: null as Body | null,
  trackedBody: null as Body | null,

  init: async function () {
    let data = fixSchema(this.data, this.schema as any);

    var el = this.el;
    this.selfBody = await getBody(this.el);
    if (this.selfBody === null) {
      throw new Error(`"body" component required for "track" component`);
    }

    this.trackedBody = await getBody(this.data.body);
    if (this.trackedBody === null) {
      throw new Error(`Cannot find body for ${this.data.body}`);
    }
  },

  tick() {
    if (this.selfBody && this.trackedBody) {
      this.selfBody.setNextPosition(add(this.trackedBody.position(), this.data.relative));
      this.selfBody.setNextRotation(this.trackedBody.rotation());
    }
  },
});
