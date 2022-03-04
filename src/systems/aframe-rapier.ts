import { registerSystem } from 'aframe';

registerSystem('rapier-physics', {
  schema: { debug: { type: 'boolean', default: false }},
  init: () => {
    console.log('initializing physics system');
  }
});
