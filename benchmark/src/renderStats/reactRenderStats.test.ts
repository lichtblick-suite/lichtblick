/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type * as ReactModule from "react";
import type * as ReactDomClient from "react-dom/client";

import { getComponentName, install, RenderStatsCollector } from "./reactRenderStats";

const DEVTOOLS_HOOK_KEY = "__REACT_DEVTOOLS_GLOBAL_HOOK__";

type Modules = {
  React: typeof ReactModule;
  createRoot: typeof ReactDomClient.createRoot;
  act: typeof ReactModule.act;
};

// react-dom only connects to the hook if it exists when react-dom is first evaluated.
function loadReactWithHook(): { collector: RenderStatsCollector } & Modules {
  let result: ({ collector: RenderStatsCollector } & Modules) | undefined;
  jest.isolateModules(() => {
    const collector = install(globalThis);
    /* eslint-disable @typescript-eslint/no-require-imports */
    const React = require("react") as typeof ReactModule;
    result = {
      collector,
      React,
      createRoot: (require("react-dom/client") as typeof ReactDomClient).createRoot,
      act: React.act,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return result!;
}

describe("getComponentName", () => {
  it("should prefer displayName, then function name, then unwrap forwardRef/memo objects", () => {
    // Given
    function Plain() {}
    const named = Object.assign(() => {}, { displayName: "Shown" });
    const forwardRef = { render: function Inner() {} };
    const memo = { type: function Wrapped() {} };

    // When / Then
    expect(getComponentName(Plain)).toBe("Plain");
    expect(getComponentName(named)).toBe("Shown");
    expect(getComponentName(forwardRef)).toBe("Inner");
    expect(getComponentName(memo)).toBe("Wrapped");
    expect(getComponentName("div")).toBe("Anonymous");
  });
});

describe("RenderStatsCollector with a real React renderer", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[DEVTOOLS_HOOK_KEY];
    delete (globalThis as Record<string, unknown>).lichtblickRenderStats;
  });

  it("should count mounts, re-renders, and why each child re-rendered", () => {
    // Given
    const { collector, React, createRoot, act } = loadReactWithHook();
    function Leaf(_props: { label: string; onClick?: () => void }) {
      return React.createElement("span");
    }
    const MemoLeaf = React.memo(function MemoLeafInner(_props: { label: string }) {
      return React.createElement("span");
    });
    function Parent({ tick }: { tick: number }) {
      return React.createElement(
        "div",
        undefined,
        React.createElement(Leaf, { label: "same" }),
        React.createElement(Leaf, { label: "x", onClick: () => {} }),
        React.createElement(Leaf, { label: String(tick) }),
        React.createElement(MemoLeaf, { label: "static" }),
      );
    }
    const root = createRoot(document.createElement("div"));
    act(() => {
      root.render(React.createElement(Parent, { tick: 0 }));
    });
    collector.reset();

    // When
    act(() => {
      root.render(React.createElement(Parent, { tick: 1 }));
    });
    const snapshot = collector.snapshot();

    // Then
    expect(snapshot.commits).toBe(1);
    expect(snapshot.components.Parent).toMatchObject({ renders: 1, mounts: 0 });
    expect(snapshot.components.Leaf).toMatchObject({
      renders: 3,
      equalProps: 1,
      changedProps: { onClick: 1, label: 1 },
    });
    expect(snapshot.components.MemoLeafInner).toBeUndefined();
    expect(snapshot.paths["Leaf < Parent"]).toMatchObject({ renders: 3 });
  });

  it("should skip subtrees React bailed out of", () => {
    // Given
    const { collector, React, createRoot, act } = loadReactWithHook();
    let setCount: (n: number) => void = () => {};
    function Child() {
      return React.createElement("span");
    }
    function Stateful() {
      const [count, set] = React.useState(0);
      setCount = set;
      return React.createElement("b", undefined, count);
    }
    function App() {
      return React.createElement(
        "div",
        undefined,
        React.createElement(Stateful),
        React.createElement(Child),
      );
    }
    const root = createRoot(document.createElement("div"));
    act(() => {
      root.render(React.createElement(App));
    });
    collector.reset();

    // When
    act(() => {
      setCount(1);
    });
    const snapshot = collector.snapshot();

    // Then
    expect(snapshot.components.Stateful).toMatchObject({ renders: 1, sameProps: 1 });
    expect(snapshot.components.App).toBeUndefined();
    expect(snapshot.components.Child).toBeUndefined();
  });
});
