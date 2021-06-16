// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { useEffect, useMemo } from "react";
import TestUtils from "react-dom/test-utils";
import { useAsync } from "react-use";

import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import LayoutCacheContext, {
  useLayoutCache,
} from "@foxglove/studio-base/context/LayoutCacheContext";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import MockLayoutCache from "@foxglove/studio-base/services/MockLayoutCache";
import delay from "@foxglove/studio-base/util/delay";
import signal from "@foxglove/studio-base/util/signal";

import LayoutBrowser from "./index";

function WithSetup(Child: Story, ctx: StoryContext): JSX.Element {
  const storage = useMemo(
    () =>
      new MockLayoutCache(
        ctx.parameters?.useMockLayouts ?? true
          ? [
              {
                id: "not-current",
                name: "Another Layout",
                path: undefined,
                state: DEFAULT_LAYOUT_FOR_TESTS,
              },
              {
                id: "test-id",
                name: "Current Layout",
                path: undefined,
                state: DEFAULT_LAYOUT_FOR_TESTS,
              },
              {
                id: "short-id",
                name: "Short",
                path: undefined,
                state: DEFAULT_LAYOUT_FOR_TESTS,
              },
            ]
          : [],
      ),
    [ctx.parameters?.useMockLayouts],
  );
  const currentLayout = useMemo(
    () =>
      new CurrentLayoutState({
        id: "test-id",
        name: "Current Layout",
        configById: {},
        globalVariables: {},
        userNodes: {},
        linkedGlobalVariables: [],
        playbackConfig: defaultPlaybackConfig,
      }),
    [],
  );
  return (
    <div style={{ display: "flex", height: 400 }}>
      <CurrentLayoutContext.Provider value={currentLayout}>
        <LayoutCacheContext.Provider value={storage}>
          <Child />
        </LayoutCacheContext.Provider>
      </CurrentLayoutContext.Provider>
    </div>
  );
}

export default {
  title: "components/LayoutBrowser",
  component: LayoutBrowser,
  decorators: [WithSetup],
};

export function Empty(): JSX.Element {
  return <LayoutBrowser />;
}
Empty.parameters = { useMockLayouts: false };

export function LayoutList(): JSX.Element {
  return <LayoutBrowser />;
}

AddLayout.parameters = { screenshot: { signal: signal() } };
export function AddLayout(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelector<HTMLElement>(`[data-test="add-layout"]`)!.click();
    await delay(10);
    ctx.parameters.screenshot.signal.resolve();
  }, [ctx.parameters.screenshot.signal]);
  return (
    <LayoutBrowser
      currentDateForStorybook={useMemo(() => new Date("2021-06-16T04:28:33.549Z"), [])}
    />
  );
}

MenuOpen.parameters = { screenshot: { signal: signal() } };
export function MenuOpen(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    ctx.parameters.screenshot.signal.resolve();
  }, [ctx.parameters.screenshot.signal]);

  return <LayoutBrowser />;
}

EditingName.parameters = { screenshot: { signal: signal() } };
export function EditingName(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    ctx.parameters.screenshot.signal.resolve();
  }, [ctx.parameters.screenshot.signal]);

  return <LayoutBrowser />;
}

CancelRenameWithEscape.parameters = { screenshot: { signal: signal() } };
export function CancelRenameWithEscape(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    TestUtils.Simulate.keyDown(document.activeElement!, { key: "Escape" });
    await delay(10);
    ctx.parameters.screenshot.signal.resolve();
  }, [ctx.parameters.screenshot.signal]);

  return <LayoutBrowser />;
}

CancelRenameWithButton.parameters = { screenshot: { signal: signal() } };
export function CancelRenameWithButton(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="cancel-rename"]`)!.click();
    await delay(10);
    ctx.parameters.screenshot.signal.resolve();
  }, [ctx.parameters.screenshot.signal]);

  return <LayoutBrowser />;
}

CommitRenameWithSubmit.parameters = { screenshot: { signal: signal() } };
export function CommitRenameWithSubmit(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    (document.activeElement as HTMLInputElement).value = "New name";
    TestUtils.Simulate.change(document.activeElement!);
    TestUtils.Simulate.submit(document.activeElement!);
  }, []);

  const layoutCache = useLayoutCache();
  useEffect(() => {
    layoutCache.list().then((layouts) => {
      if (layouts.some((layout) => layout.name === "New name")) {
        ctx.parameters.screenshot.signal.resolve();
      }
    });
  });

  return <LayoutBrowser />;
}

CommitRenameWithButton.parameters = { screenshot: { signal: signal() } };
export function CommitRenameWithButton(_args: unknown, ctx: StoryContext): JSX.Element {
  useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    (document.activeElement as HTMLInputElement).value = "New name";
    TestUtils.Simulate.change(document.activeElement!);
    document.querySelector<HTMLElement>(`[data-test="commit-rename"]`)!.click();
  }, []);

  const layoutCache = useLayoutCache();
  useEffect(() => {
    layoutCache.list().then((layouts) => {
      if (layouts.some((layout) => layout.name === "New name")) {
        ctx.parameters.screenshot.signal.resolve();
      }
    });
  });

  return <LayoutBrowser />;
}

Duplicate.parameters = { screenshot: { signal: signal() } };
export function Duplicate(_args: unknown, ctx: StoryContext): JSX.Element {
  const layoutCache = useLayoutCache();
  const { error } = useAsync(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="duplicate-layout"]`)!.click();
    await delay(10);

    if ((await layoutCache.list()).some((layout) => layout.name === "Current Layout copy")) {
      ctx.parameters.screenshot.signal.resolve();
    } else {
      throw new Error("Duplicate failed");
    }
  }, [ctx.parameters.screenshot.signal, layoutCache]);
  if (error) {
    throw error;
  }

  useEffect(() => {});

  return <LayoutBrowser />;
}
