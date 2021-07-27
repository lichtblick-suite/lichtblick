// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { useEffect, useMemo } from "react";
import TestUtils from "react-dom/test-utils";
import { useAsync } from "react-use";
import { AsyncState } from "react-use/lib/useAsyncFn";

import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import LayoutCacheContext, {
  useLayoutCache,
} from "@foxglove/studio-base/context/LayoutCacheContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import CacheOnlyLayoutStorageProvider from "@foxglove/studio-base/providers/CacheOnlyLayoutStorageProvider";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import MockLayoutCache from "@foxglove/studio-base/services/MockLayoutCache";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";
import delay from "@foxglove/studio-base/util/delay";

import LayoutBrowser from "./index";

function WithSetup(Child: Story, ctx: StoryContext): JSX.Element {
  const storage = useMemo(
    () =>
      new MockLayoutCache(
        ctx.parameters?.mockLayouts ?? [
          {
            id: "not-current",
            name: "Another Layout",
            path: ["some", "path"],
            state: { ...DEFAULT_LAYOUT_FOR_TESTS, id: "not-current", name: "Another Layout" },
          },
          {
            id: "test-id",
            name: "Current Layout",
            path: undefined,
            state: { ...DEFAULT_LAYOUT_FOR_TESTS, id: "test-id", name: "Current Layout" },
          },
          {
            id: "short-id",
            name: "Short",
            path: undefined,
            state: { ...DEFAULT_LAYOUT_FOR_TESTS, id: "short-id", name: "Short" },
          },
        ],
      ),
    [ctx.parameters?.mockLayouts],
  );
  const currentLayout = useMemo(
    () =>
      new CurrentLayoutState({
        selectedLayout: {
          id: "test-id" as LayoutID,
          data: {
            configById: {},
            globalVariables: {},
            userNodes: {},
            linkedGlobalVariables: [],
            playbackConfig: defaultPlaybackConfig,
          },
        },
      }),
    [],
  );
  return (
    <div style={{ display: "flex", height: 400 }}>
      <ModalHost>
        <AnalyticsProvider>
          <CurrentLayoutContext.Provider value={currentLayout}>
            <LayoutCacheContext.Provider value={storage}>
              <CacheOnlyLayoutStorageProvider>
                <Child />
              </CacheOnlyLayoutStorageProvider>
            </LayoutCacheContext.Provider>
          </CurrentLayoutContext.Provider>
        </AnalyticsProvider>
      </ModalHost>
    </div>
  );
}

/** Throw errors from the async function during render so they appear in the storybook */
function useAsyncThrowing(fn: () => Promise<void>, deps: unknown[]): AsyncState<void> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useAsync(fn, deps);
  if (result.error) {
    throw result.error;
  }
  return result;
}

export default {
  title: "components/LayoutBrowser",
  component: LayoutBrowser,
  decorators: [WithSetup],
};

export function Empty(): JSX.Element {
  return <LayoutBrowser />;
}
Empty.parameters = { mockLayouts: [] };

export function LayoutList(): JSX.Element {
  return <LayoutBrowser />;
}

AddLayout.parameters = { useReadySignal: true };
export function AddLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelector<HTMLElement>(`[data-test="add-layout"]`)!.click();
    await delay(10);
    readySignal();
  }, [readySignal]);
  return (
    <LayoutBrowser
      currentDateForStorybook={useMemo(() => new Date("2021-06-16T04:28:33.549Z"), [])}
    />
  );
}

MenuOpen.parameters = { useReadySignal: true };
export function MenuOpen(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    readySignal();
  }, [readySignal]);

  return <LayoutBrowser />;
}

EditingName.parameters = { useReadySignal: true };
export function EditingName(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    readySignal();
  }, [readySignal]);

  return <LayoutBrowser />;
}

CancelRenameWithEscape.parameters = { useReadySignal: true };
export function CancelRenameWithEscape(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    TestUtils.Simulate.keyDown(document.activeElement!, { key: "Escape" });
    await delay(10);
    readySignal();
  }, [readySignal]);

  return <LayoutBrowser />;
}

CancelRenameWithButton.parameters = { useReadySignal: true };
export function CancelRenameWithButton(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="cancel-rename"]`)!.click();
    await delay(10);
    readySignal();
  }, [readySignal]);

  return <LayoutBrowser />;
}

CommitRenameWithSubmit.parameters = { useReadySignal: true };
export function CommitRenameWithSubmit(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
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
    void layoutCache.list().then((layouts) => {
      if (layouts.some((layout) => layout.name === "New name")) {
        readySignal();
      }
    });
  });

  return <LayoutBrowser />;
}

CommitRenameWithButton.parameters = { useReadySignal: true };
export function CommitRenameWithButton(_args: unknown): JSX.Element {
  useAsyncThrowing(async () => {
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
  const readySignal = useReadySignal();

  useEffect(() => {
    void layoutCache.list().then((layouts) => {
      if (layouts.some((layout) => layout.name === "New name")) {
        readySignal();
      }
    });
  });

  return <LayoutBrowser />;
}

Duplicate.parameters = { useReadySignal: true };
export function Duplicate(_args: unknown): JSX.Element {
  const layoutCache = useLayoutCache();
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="duplicate-layout"]`)!.click();
    await delay(10);

    if ((await layoutCache.list()).some((layout) => layout.name === "Current Layout copy")) {
      readySignal();
    } else {
      throw new Error("Duplicate failed");
    }
  }, [readySignal, layoutCache]);

  return <LayoutBrowser />;
}

function DeleteStory({
  index,
  name,
  signal: sig,
}: {
  index: number;
  name: string;
  signal: () => void;
}) {
  const layoutCache = useLayoutCache();
  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[index]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="delete-layout"]`)!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`button[type="submit"]`)!.click();
    await delay(10);

    if (!(await layoutCache.list()).some((layout) => layout.name === name)) {
      sig();
    } else {
      throw new Error("Delete failed");
    }
  }, [sig, index, layoutCache, name]);

  return <LayoutBrowser />;
}

export function DeleteLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();
  return <DeleteStory index={0} name="Another Layout" signal={readySignal} />;
}
DeleteLayout.parameters = { useReadySignal: true };

export function DeleteSelectedLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();
  return <DeleteStory index={1} name="Current Layout" signal={readySignal} />;
}
DeleteSelectedLayout.parameters = { useReadySignal: true };

export function DeleteLastLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  return <DeleteStory index={0} name="Current Layout" signal={readySignal} />;
}
DeleteLastLayout.parameters = {
  useReadySignal: true,
  mockLayouts: [
    {
      id: "test-id",
      name: "Current Layout",
      path: undefined,
      state: DEFAULT_LAYOUT_FOR_TESTS,
    },
  ],
};
