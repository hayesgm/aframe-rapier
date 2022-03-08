
const cooldown = new Map<string, number>();

export function tdebug(name: string, ...args: any[]) {
  let last = cooldown.get(name);
  let now = Date.now();

  if (last === undefined || now - last > 1000) {
    console.log(name, ...args);
    cooldown.set(name, now);
  }
}