
export function buildPromise<T>(): [Promise<T>, (v: T) => void, () => void] {
  let resolve: (v: T) => void | undefined;
  let reject: () => void | undefined;
  let p = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });

  return [p, resolve!, reject!];
}
