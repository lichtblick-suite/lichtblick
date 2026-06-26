---
applyTo: "**/*.ts,**/*.tsx"
---

# Performance Guidelines

These rules apply to ALL TypeScript and TSX code in the Lichtblick monorepo. Violations cause measurable frame drops, memory pressure, or delayed startup.

## Allocation Rules

- Never allocate inside render loops, `requestAnimationFrame`, or `tick()` callbacks
- Reuse typed arrays and buffers — prefer `.set()` over creating new instances
- Prefer `for` loops over `.map()` / `.filter()` / `.reduce()` in hot paths (avoids intermediate allocations)
- Use object pools for frequently created/destroyed objects (e.g., `THREE.Vector3`)

## React Performance

### Memoization Strategy

- Memoize expensive computations with `useMemo` — include correct dependency arrays
- Use `useCallback` for event handlers passed as props to memoized child components
- Avoid inline object/array literals in JSX props (creates new reference every render)
- Prefer `React.memo()` for pure presentational components receiving complex props that render frequently
- Do NOT over-memoize — small, fast-rendering components don't need `React.memo()`; the comparison overhead may exceed the render cost
- Profile first: use React DevTools Profiler to confirm a component re-renders expensively before adding memoization

### Re-render Prevention

- Never call `setState` unconditionally inside `useEffect` — causes double render
- Avoid anonymous functions in JSX when passing to memoized children (breaks reference equality)
- Move utility/pure functions outside the component body — prevents recreation on every render
- Use `useTransition` for non-urgent updates (e.g., filtering large datasets) to keep the UI responsive
- Use `useDeferredValue` to defer expensive derived computations without blocking user input

### Context Optimization

- Split React Context into small, domain-specific contexts — a single context update re-renders ALL consumers
- Keep frequently-changing state (e.g., playback position) in zustand stores with selectors, not in Context
- Context is appropriate for static/rarely-changing values: theme, locale, feature flags
- Use custom hooks with selectors to read only needed values from a context

### List & Virtualization

- Virtualize large lists (>50 items) — render only visible items plus a buffer
- Use stable, unique `key` props (never array index for dynamic/reorderable lists)
- Memoize list item components with `React.memo` when items receive complex props
- Cache filtered/sorted arrays with `useMemo` to avoid recomputation on every render

### Code Splitting & Lazy Loading

- Use `React.lazy()` + `Suspense` for heavy panels and rarely-used views
- Lazy-load 3rd-party integrations (chart libraries, editors, maps) on demand
- Route-level code splitting is handled by webpack — keep panel entry points dynamic-importable

### State Colocation

- Keep state as close as possible to where it's used — avoid lifting state unnecessarily
- Local component state that only affects one subtree should NOT live in a global store
- When multiple sibling components need the same state, lift to the nearest common parent only

## Worker & Async Patterns

- Offload CPU-intensive work (>16ms) to Web Workers
- Use `Comlink.transfer()` for large `ArrayBuffer`/`TypedArray` to avoid copying
- Batch state updates — avoid emitting state on every single message
- Debounce high-frequency emitters (use `requestAnimationFrame` or explicit intervals)

## Memory Management

- Release references to large buffers when no longer needed
- Use `FinalizationRegistry` for cleanup of Worker proxies (see `ComlinkWrap`)
- Watch for subscription leaks — always unsubscribe in cleanup/dispose
- Avoid retaining full message history when only latest value is needed

## Data Structures

- Use `Map` / `Set` over plain objects for dynamic keys (better GC, O(1) ops)
- Prefer `TypedArray` for numeric data (compact, no boxing)
- Use structural sharing (immutable updates) in state stores to enable reference-equality checks

## Measurement

- Profile with Chrome DevTools Performance tab before and after changes
- Use React DevTools Profiler to identify components with high render frequency or cost
- Watch for GC pressure spikes in the Memory panel
- Validate with `performance.now()` for timing-critical paths
- Check bundle impact with `yarn build:packages` — avoid unnecessary imports
- Measure before you optimize: if profiling shows no measurable issue, don't add complexity
