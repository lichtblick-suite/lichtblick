// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { useEffect, useMemo } from "react";
import TestUtils from "react-dom/test-utils";
import { useAsync } from "react-use";
import { AsyncState } from "react-use/lib/useAsyncFn";

import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import LayoutStorageContext, {
  useLayoutStorage,
} from "@foxglove/studio-base/context/LayoutStorageContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { UserProfileStorageContext } from "@foxglove/studio-base/context/UserProfileStorageContext";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import { ISO8601Timestamp, Layout, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager";
import MockLayoutStorage from "@foxglove/studio-base/services/MockLayoutStorage";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";
import delay from "@foxglove/studio-base/util/delay";

import LayoutBrowser from "./index";

const DEFAULT_LAYOUT_FOR_TESTS: PanelsState = {
  configById: {},
  globalVariables: {},
  userNodes: {},
  linkedGlobalVariables: [],
  playbackConfig: defaultPlaybackConfig,
};

const exampleCurrentLayout: Layout = {
  id: "test-id" as LayoutID,
  name: "Current Layout",
  baseline: {
    data: DEFAULT_LAYOUT_FOR_TESTS,
    savedAt: new Date(10).toISOString() as ISO8601Timestamp,
  },
  permission: "CREATOR_WRITE",
  working: undefined,
  syncInfo: undefined,
};
function WithSetup(Child: Story, ctx: StoryContext): JSX.Element {
  const storage = useMemo(
    () =>
      new MockLayoutStorage(
        LayoutManager.LOCAL_STORAGE_NAMESPACE,
        (ctx.parameters?.mockLayouts as Layout[] | undefined) ?? [
          {
            id: "not-current" as LayoutID,
            name: "Another Layout",
            baseline: {
              data: DEFAULT_LAYOUT_FOR_TESTS,
              savedAt: new Date(10).toISOString() as ISO8601Timestamp,
            },
            permission: "CREATOR_WRITE",
            working: undefined,
            syncInfo: undefined,
          },
          exampleCurrentLayout,
          {
            id: "short-id" as LayoutID,
            name: "Short",
            baseline: {
              data: DEFAULT_LAYOUT_FOR_TESTS,
              savedAt: new Date(10).toISOString() as ISO8601Timestamp,
            },
            permission: "CREATOR_WRITE",
            working: undefined,
            syncInfo: undefined,
          },
        ],
      ),
    [ctx.parameters?.mockLayouts],
  );
  const userProfile = useMemo(
    () => ({
      getUserProfile: async () => ({ currentLayoutId: "test-id" as LayoutID }),
      setUserProfile: async () => {},
    }),
    [],
  );
  return (
    <div style={{ display: "flex", height: "100%", width: 320 }}>
      <ModalHost>
        <AnalyticsProvider>
          <UserProfileStorageContext.Provider value={userProfile}>
            <LayoutStorageContext.Provider value={storage}>
              <LayoutManagerProvider>
                <CurrentLayoutProvider>
                  <Child />
                </CurrentLayoutProvider>
              </LayoutManagerProvider>
            </LayoutStorageContext.Provider>
          </UserProfileStorageContext.Provider>
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

TruncatedLayoutName.parameters = {
  mockLayouts: [
    {
      id: "not-current",
      name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
      baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, updatedAt: new Date(10).toISOString() },
    },
  ],
};
export function TruncatedLayoutName(): JSX.Element {
  return <LayoutBrowser />;
}

TruncatedLayoutNameSelected.parameters = {
  mockLayouts: [
    {
      id: "test-id",
      name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
      baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, updatedAt: new Date(10).toISOString() },
    },
  ],
};
export function TruncatedLayoutNameSelected(): JSX.Element {
  return <LayoutBrowser />;
}

AddLayout.parameters = { useReadySignal: true, colorScheme: "dark" };
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

MenuOpen.parameters = { useReadySignal: true, colorScheme: "dark" };
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
export const MenuOpenLight = MenuOpen.bind(undefined);
MenuOpenLight.parameters = { useReadySignal: true, colorScheme: "light" };

EditingName.parameters = { useReadySignal: true, colorScheme: "dark" };
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

CancelRenameWithEscape.parameters = { useReadySignal: true, colorScheme: "dark" };
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

CommitRenameWithTab.parameters = { useReadySignal: true, colorScheme: "dark" };
export function CommitRenameWithTab(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="rename-layout"]`)!.click();
    await delay(10);
    (document.activeElement as HTMLInputElement).value = "New name";
    TestUtils.Simulate.change(document.activeElement!);
    await delay(10);
    TestUtils.Simulate.blur(document.activeElement!);
    readySignal();
  }, [readySignal]);

  const layoutStorage = useLayoutStorage();
  useEffect(() => {
    void layoutStorage.list(LayoutManager.LOCAL_STORAGE_NAMESPACE).then((layouts) => {
      if (layouts.some((layout) => layout.name === "New name")) {
        readySignal();
      }
    });
  });

  return <LayoutBrowser />;
}

Duplicate.parameters = { useReadySignal: true, colorScheme: "dark" };
export function Duplicate(_args: unknown): JSX.Element {
  const layoutStorage = useLayoutStorage();
  const readySignal = useReadySignal();

  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[1]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="duplicate-layout"]`)!.click();
    await delay(10);

    if (
      (await layoutStorage.list(LayoutManager.LOCAL_STORAGE_NAMESPACE)).some(
        (layout) => layout.name === "Current Layout copy",
      )
    ) {
      readySignal();
    } else {
      throw new Error("Duplicate failed");
    }
  }, [readySignal, layoutStorage]);

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
  const layoutStorage = useLayoutStorage();
  useAsyncThrowing(async () => {
    await delay(100);
    document.querySelectorAll<HTMLElement>(`[data-test="layout-actions"]`)[index]!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`[data-test="delete-layout"]`)!.click();
    await delay(10);
    document.querySelector<HTMLElement>(`button[type="submit"]`)!.click();
    await delay(10);

    if (
      !(await layoutStorage.list(LayoutManager.LOCAL_STORAGE_NAMESPACE)).some(
        (layout) => layout.name === name,
      )
    ) {
      sig();
    } else {
      throw new Error("Delete failed");
    }
  }, [sig, index, layoutStorage, name]);

  return <LayoutBrowser />;
}

export function DeleteLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();
  return <DeleteStory index={0} name="Another Layout" signal={readySignal} />;
}
DeleteLayout.parameters = { useReadySignal: true, colorScheme: "dark" };

export function DeleteSelectedLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();
  return <DeleteStory index={1} name="Current Layout" signal={readySignal} />;
}
DeleteSelectedLayout.parameters = { useReadySignal: true, colorScheme: "dark" };

export function DeleteLastLayout(_args: unknown): JSX.Element {
  const readySignal = useReadySignal();

  return <DeleteStory index={0} name="Current Layout" signal={readySignal} />;
}
DeleteLastLayout.parameters = {
  useReadySignal: true,
  mockLayouts: [exampleCurrentLayout],
  colorScheme: "dark",
};
