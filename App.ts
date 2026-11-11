/**
 * Forge Launcher — App.ts · the app core (not the React shell).
 * The launcher's logical application: a view registry, a lifecycle
 * (register → start → stop) and a tiny event bus. core.tsx is the React
 * face; this is the framework-neutral brain other modules (tab-snap,
 * settings, sim) can drive headlessly.
 */

export type ViewFactory = (ctx: AppContext) => ViewHandle;
export type ViewHandle = { mount?: () => void | Promise<void>; unmount?: () => void };

export type AppContext = {
  app: App;
  params: Record<string, string>;
  emit: (evt: string, payload?: unknown) => void;
};

export class App {
  readonly views = new Map<string, ViewFactory>();
  private listeners = new Map<string, Set<(p: unknown) => void>>();
  private current: { name: string; handle: ViewHandle } | null = null;
  private started = false;

  /** Register a view factory under a name ("play", "bedrock", …). */
  registerView(name: string, factory: ViewFactory): this {
    this.views.set(name, factory);
    return this;
  }

  on(evt: string, fn: (payload: unknown) => void): () => void {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt)!.add(fn);
    return () => this.listeners.get(evt)?.delete(fn);
  }

  emit(evt: string, payload?: unknown): void {
    for (const fn of this.listeners.get(evt) ?? []) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[app:${evt}]`, e);
      }
    }
    for (const fn of this.listeners.get("*") ?? []) fn({ evt, payload });
  }

  /** Boot the app — emits "boot" once. */
  start(): this {
    if (this.started) return this;
    this.started = true;
    this.emit("boot", { views: [...this.views.keys()] });
    return this;
  }

  /** Switch views: unmount the old, mount the new. */
  async show(name: string, params: Record<string, string> = {}): Promise<boolean> {
    const factory = this.views.get(name);
    if (!factory) {
      this.emit("error", { reason: `unknown view "${name}"` });
      return false;
    }
    await this.current?.handle.unmount?.();
    const ctx: AppContext = { app: this, params, emit: (e, p) => this.emit(e, p) };
    const handle = factory(ctx);
    await handle.mount?.();
    this.current = { name, handle };
    this.emit("view", { name, params });
    return true;
  }

  get view(): string | null {
    return this.current?.name ?? null;
  }

  get isStarted(): boolean {
    return this.started;
  }

  /** Teardown: unmount + drop listeners. */
  stop(): void {
    this.current?.handle.unmount?.();
    this.current = null;
    this.started = false;
    this.listeners.clear();
    this.emit("stop", {});
  }
}

/** The one app instance the launcher would use. */
export const app = new App();
export default app;
