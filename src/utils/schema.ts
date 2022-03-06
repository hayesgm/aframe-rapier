
export type Schema = { [field: string]: { type: string, default: any }};

export function fixSchema<T extends object>(input: true | T, schema: Schema) {
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
  return res as T;
}
