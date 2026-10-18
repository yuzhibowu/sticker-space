type Entry<T> = { value?: T; error?: Error; users: number; listeners: Set<(value?: T) => void>; timer?: ReturnType<typeof setTimeout> };
/** 同一素材只加载一次；引用归零后延迟回收，允许悬浮预览快速重新使用。 */
export class ResourcePool<T> {
  private entries = new Map<string, Entry<T>>();
  constructor(private load: (key: string) => Promise<T>, private dispose: (value: T) => void, private retention = 200) {}
  acquire(key: string, listener: (value?: T) => void) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { users: 0, listeners: new Set() }; this.entries.set(key, entry);
      const created = entry;
      this.load(key).then(value => {
        if (this.entries.get(key) !== created) { this.dispose(value); return; }
        created.value = value; created.listeners.forEach(notify => notify(value));
      }).catch(error => { created.error = error; created.listeners.forEach(notify => notify()); });
    }
    clearTimeout(entry.timer); entry.users++; entry.listeners.add(listener); listener(entry.value);
    let released = false;
    return () => {
      if (released) return; released = true;
      entry!.users--; entry!.listeners.delete(listener);
      if (!entry!.users) entry!.timer = setTimeout(() => {
        if (entry!.users || this.entries.get(key) !== entry) return;
        this.entries.delete(key); if (entry!.value) this.dispose(entry!.value);
      }, this.retention);
    };
  }
  get stats() { return { loaded: [...this.entries.values()].filter(e => e.value).length, users: [...this.entries.values()].reduce((sum, e) => sum + e.users, 0) }; }
}
