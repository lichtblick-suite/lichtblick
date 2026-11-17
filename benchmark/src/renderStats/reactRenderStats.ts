// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Minimal stand-in for the React DevTools global hook that counts, per component, how often it
 * rendered and why. React only reports to the hook if it exists before `react-dom` is evaluated,
 * so `install()` must run before anything imports `react-dom`.
 */

// React 18 fiber internals; only the fields read here.
export type Fiber = {
  tag: number;
  type: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
  alternate: Fiber | null;
  flags: number;
  memoizedProps: unknown;
  selfBaseDuration?: number;
};
type FiberRoot = { current: Fiber };

const FUNCTION_COMPONENT = 0;
const CLASS_COMPONENT = 1;
const FORWARD_REF = 11;
const SIMPLE_MEMO_COMPONENT = 15;
// MemoComponent (14) is skipped: its child fiber is the component that actually renders.
const COMPONENT_TAGS = new Set([
  FUNCTION_COMPONENT,
  CLASS_COMPONENT,
  FORWARD_REF,
  SIMPLE_MEMO_COMPONENT,
]);
const PERFORMED_WORK = 1;
const ANCESTOR_DEPTH = 2;
const MAX_REPORTED = 150;

export type ComponentRenderStats = {
  /** Re-renders of an already mounted component. */
  renders: number;
  mounts: number;
  /** Own render time; only non-zero with the `react-dom/profiling` build. */
  selfMs: number;
  /** Re-rendered with the identical props object (state, context or a parent bailout path). */
  sameProps: number;
  /** Re-rendered with a new but shallow-equal props object: `React.memo` would skip these. */
  equalProps: number;
  /** Prop name -> number of re-renders where it changed identity. */
  changedProps: Record<string, number>;
};

export type RenderStatsSnapshot = {
  durationMs: number;
  commits: number;
  components: Record<string, ComponentRenderStats>;
  /** Same counts keyed by `Component < Parent < GrandParent` to locate where renders come from. */
  paths: Record<string, Pick<ComponentRenderStats, "renders" | "selfMs">>;
};

export function getComponentName(type: unknown): string {
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? (fn.name !== "" ? fn.name : undefined) ?? "Anonymous";
  }
  if (type != undefined && typeof type === "object") {
    const wrapper = type as { displayName?: string; render?: unknown; type?: unknown };
    if (wrapper.displayName != undefined) {
      return wrapper.displayName;
    }
    if (wrapper.render != undefined) {
      return getComponentName(wrapper.render);
    }
    if (wrapper.type != undefined) {
      return getComponentName(wrapper.type);
    }
  }
  return "Anonymous";
}

function changedPropNames(prev: unknown, next: unknown): string[] {
  if (
    prev == undefined ||
    next == undefined ||
    typeof prev !== "object" ||
    typeof next !== "object"
  ) {
    return Object.is(prev, next) ? [] : ["(props)"];
  }
  const prevProps = prev as Record<string, unknown>;
  const nextProps = next as Record<string, unknown>;
  const changed: string[] = [];
  for (const key of new Set([...Object.keys(prevProps), ...Object.keys(nextProps)])) {
    if (!Object.is(prevProps[key], nextProps[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export class RenderStatsCollector {
  #components = new Map<string, ComponentRenderStats>();
  #paths = new Map<string, { renders: number; selfMs: number }>();
  #commits = 0;
  #startedAt = performance.now();

  public reset(): void {
    this.#components.clear();
    this.#paths.clear();
    this.#commits = 0;
    this.#startedAt = performance.now();
  }

  public onCommit(root: FiberRoot): void {
    this.#commits++;
    this.#walk(root.current, root.current.alternate);
  }

  public snapshot(): RenderStatsSnapshot {
    const top = <T extends { renders: number; selfMs: number }>(map: Map<string, T>) =>
      Object.fromEntries(
        [...map]
          .sort((a, b) =>
            b[1].renders !== a[1].renders ? b[1].renders - a[1].renders : b[1].selfMs - a[1].selfMs,
          )
          .slice(0, MAX_REPORTED),
      );
    return {
      durationMs: performance.now() - this.#startedAt,
      commits: this.#commits,
      components: top(this.#components),
      paths: top(this.#paths),
    };
  }

  #walk(fiber: Fiber, prev: Fiber | null): void {
    if (COMPONENT_TAGS.has(fiber.tag)) {
      this.#record(fiber, prev);
    }
    // An unchanged child pointer means React bailed out of the whole subtree.
    if (prev?.child === fiber.child) {
      return;
    }
    for (let child = fiber.child; child != undefined; child = child.sibling) {
      this.#walk(child, child.alternate);
    }
  }

  #record(fiber: Fiber, prev: Fiber | null): void {
    const isMount = prev == undefined;
    if (!isMount && (fiber.flags & PERFORMED_WORK) === 0) {
      return;
    }
    const name = getComponentName(fiber.type);
    let stats = this.#components.get(name);
    if (!stats) {
      stats = { renders: 0, mounts: 0, selfMs: 0, sameProps: 0, equalProps: 0, changedProps: {} };
      this.#components.set(name, stats);
    }
    const selfMs = fiber.selfBaseDuration ?? 0;
    stats.selfMs += selfMs;
    if (isMount) {
      stats.mounts++;
      return;
    }
    stats.renders++;
    if (prev.memoizedProps === fiber.memoizedProps) {
      stats.sameProps++;
    } else {
      const changed = changedPropNames(prev.memoizedProps, fiber.memoizedProps);
      if (changed.length === 0) {
        stats.equalProps++;
      }
      for (const key of changed) {
        stats.changedProps[key] = (stats.changedProps[key] ?? 0) + 1;
      }
    }

    const ancestors: string[] = [];
    for (
      let parent = fiber.return;
      parent != undefined && ancestors.length < ANCESTOR_DEPTH;
      parent = parent.return
    ) {
      if (COMPONENT_TAGS.has(parent.tag)) {
        ancestors.push(getComponentName(parent.type));
      }
    }
    const path = [name, ...ancestors].join(" < ");
    const pathStats = this.#paths.get(path) ?? { renders: 0, selfMs: 0 };
    pathStats.renders++;
    pathStats.selfMs += selfMs;
    this.#paths.set(path, pathStats);
  }
}

/** Installs the hook and exposes `window.lichtblickRenderStats` for the benchmark spec. */
export function install(target: typeof globalThis = globalThis): RenderStatsCollector {
  const collector = new RenderStatsCollector();
  let rendererCount = 0;
  Object.assign(target, {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      supportsFiber: true,
      inject: () => ++rendererCount,
      onScheduleFiberRoot: () => {},
      onCommitFiberRoot: (_rendererId: number, root: FiberRoot) => {
        collector.onCommit(root);
      },
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
      checkDCE: () => {},
    },
    lichtblickRenderStats: {
      reset: () => {
        collector.reset();
      },
      snapshot: () => collector.snapshot(),
    },
  });
  return collector;
}
