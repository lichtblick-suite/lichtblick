// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { fireEvent, screen } from "@testing-library/dom";
import { useMemo } from "react";

import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { UserProfileStorageContext } from "@foxglove/studio-base/context/UserProfileStorageContext";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import { ISO8601Timestamp, Layout, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager/LayoutManager";
import MockLayoutStorage from "@foxglove/studio-base/services/MockLayoutStorage";

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

const deleteLayoutInteraction = async (index: number) => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[index]) {
    fireEvent.click(actions[index]!);
  }
  const deleteButton = await screen.findByText("Delete");
  fireEvent.click(deleteButton);
  const confirmButton = await screen.findByText("Delete");
  fireEvent.click(confirmButton);
};

function WithSetup(Child: Story, ctx: StoryContext): JSX.Element {
  const storage = useMemo(
    () =>
      new MockLayoutStorage(
        LayoutManager.LOCAL_STORAGE_NAMESPACE,
        (ctx.parameters.mockLayouts as Layout[] | undefined) ?? [
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
    [ctx.parameters.mockLayouts],
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

export function MultiSelect(): JSX.Element {
  return <LayoutBrowser />;
}
MultiSelect.parameters = { colorScheme: "dark" };
MultiSelect.play = async () => {
  const layouts = await screen.findAllByTestId("layout-list-item");
  layouts.forEach((layout) => fireEvent.click(layout, { ctrlKey: true }));
};

export function MultiDelete(): JSX.Element {
  return <LayoutBrowser />;
}
MultiDelete.parameters = { colorScheme: "dark" };
MultiDelete.play = async () => {
  const layouts = await screen.findAllByTestId("layout-list-item");
  layouts.forEach((layout) => fireEvent.click(layout, { ctrlKey: true }));
  const deleteButton = await screen.findAllByTitle("Delete Selected");
  if (deleteButton[0]) {
    fireEvent.click(deleteButton[0]);
  }
  const confirmButton = await screen.findByText("Delete");
  fireEvent.click(confirmButton);
};

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

export function AddLayout(_args: unknown): JSX.Element {
  return (
    <LayoutBrowser
      currentDateForStorybook={useMemo(() => new Date("2021-06-16T04:28:33.549Z"), [])}
    />
  );
}
AddLayout.parameters = { colorScheme: "dark" };
AddLayout.play = async () => {
  const button = await screen.findByTestId("add-layout");
  fireEvent.click(button);
};

export function MenuOpen(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
MenuOpen.parameters = { colorScheme: "dark" };
MenuOpen.play = async () => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[1]) {
    fireEvent.click(actions[1]);
  }
};

export const MenuOpenLight = MenuOpen.bind(undefined);
MenuOpenLight.parameters = { colorScheme: "light" };
MenuOpenLight.play = async () => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[1]) {
    fireEvent.click(actions[1]);
  }
};

export function EditingName(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
EditingName.parameters = { colorScheme: "dark" };
EditingName.play = async () => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[1]) {
    fireEvent.click(actions[1]);
  }
  const button = await screen.findByText("Rename");
  fireEvent.click(button);
};

export function CancelRenameWithEscape(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
CancelRenameWithEscape.parameters = { colorScheme: "dark" };
CancelRenameWithEscape.play = async () => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[1]) {
    fireEvent.click(actions[1]);
  }
  const button = await screen.findByText("Rename");
  fireEvent.click(button);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
};

export function CommitRenameWithTab(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
CommitRenameWithTab.parameters = { colorScheme: "dark" };
CommitRenameWithTab.play = async () => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[1]) {
    fireEvent.click(actions[1]);
  }
  const button = await screen.findByText("Rename");
  fireEvent.click(button);
  fireEvent.change(document.activeElement!, { target: { value: "New name" } });
  fireEvent.focusOut(document.activeElement!);
};

export function Duplicate(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
Duplicate.parameters = { colorScheme: "dark" };
Duplicate.play = async () => {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[1]) {
    fireEvent.click(actions[1]);
  }
  const button = await screen.findByText("Duplicate");
  fireEvent.click(button);
};

export function DeleteLayout(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
DeleteLayout.parameters = { colorScheme: "dark" };
DeleteLayout.play = async () => await deleteLayoutInteraction(0);

export function DeleteSelectedLayout(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
DeleteSelectedLayout.play = async () => {
  const layouts = await screen.findAllByTestId("layout-list-item");
  if (layouts[1]) {
    fireEvent.click(layouts[1]);
  }
  await deleteLayoutInteraction(1);
};
DeleteSelectedLayout.parameters = { colorScheme: "dark" };

export function DeleteLastLayout(_args: unknown): JSX.Element {
  return <LayoutBrowser />;
}
DeleteLastLayout.parameters = {
  mockLayouts: [exampleCurrentLayout],
  colorScheme: "dark",
};
DeleteLastLayout.play = async () => await deleteLayoutInteraction(0);
