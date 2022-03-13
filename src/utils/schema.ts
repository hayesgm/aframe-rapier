import { Schema } from 'aframe';

export function fixSchema<D extends object>(input: true | D, schema: Schema<D>) {
  let res: { [field: string]: any };
  if (input === true) {
    res = {};
  } else {
    res = input as object;
  }

  for (let [field, scheme] of Object.entries(schema)) {
    if (res[field] === undefined) {
      res[field] = scheme.default;
    }
  }
  return res as D;
}
