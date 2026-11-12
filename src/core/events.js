// Minimal synchronous event bus. Event names follow the GDD contracts (section 20.2).
export class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
  emit(type, payload) {
    const set = this.map.get(type);
    if (set) for (const fn of [...set]) fn(payload);
    const any = this.map.get('*');
    if (any) for (const fn of [...any]) fn(type, payload);
  }
}
export const bus = new Emitter();
