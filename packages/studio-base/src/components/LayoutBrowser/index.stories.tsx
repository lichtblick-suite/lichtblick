// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { fireEvent, screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
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

const notCurrentLayout: Layout = {
  id: "not-current" as LayoutID,
  name: "Another Layout",
  baseline: {
    data: DEFAULT_LAYOUT_FOR_TESTS,
    savedAt: new Date(10).toISOString() as ISO8601Timestamp,
  },
  permission: "CREATOR_WRITE",
  working: undefined,
  syncInfo: undefined,
};

const shortLayout: Layout = {
  id: "short-id" as LayoutID,
  name: "Short",
  baseline: {
    data: DEFAULT_LAYOUT_FOR_TESTS,
    savedAt: new Date(10).toISOString() as ISO8601Timestamp,
  },
  permission: "CREATOR_WRITE",
  working: undefined,
  syncInfo: undefined,
};

function makeUnsavedLayout(id: number): Layout {
  return {
    id: `unsaved-id-${id}` as LayoutID,
    name: `Unsaved Layout ${id}`,
    baseline: {
      data: DEFAULT_LAYOUT_FOR_TESTS,
      savedAt: new Date(10).toISOString() as ISO8601Timestamp,
    },
    permission: "CREATOR_WRITE",
    working: { data: DEFAULT_LAYOUT_FOR_TESTS, savedAt: undefined },
    syncInfo: undefined,
  };
}

async function clickMenuButtonAction(index: number) {
  const actions = await screen.findAllByTestId("layout-actions");
  if (actions[index]) {
    fireEvent.click(actions[index]!);
  }
}

async function deleteLayoutInteraction(index: number) {
  await clickMenuButtonAction(index);

  const deleteButton = await screen.findByText("Delete");
  fireEvent.click(deleteButton);
  const confirmButton = await screen.findByText("Delete");
  fireEvent.click(confirmButton);
}

async function doMultiAction(action: string) {
  await selectAllAction();
  await clickMenuButtonAction(0);
  const button = await screen.findByText(action);
  fireEvent.click(button);
}

async function selectAllAction() {
  const layouts = await screen.findAllByTestId("layout-list-item");
  layouts.forEach((layout) => fireEvent.click(layout, { ctrlKey: true }));
}

function WithSetup(Child: Story, ctx: StoryContext): JSX.Element {
  const storage = useMemo(
    () =>
      new MockLayoutStorage(
        LayoutManager.LOCAL_STORAGE_NAMESPACE,
        (ctx.parameters.mockLayouts as Layout[] | undefined) ?? [
          notCurrentLayout,
          exampleCurrentLayout,
          shortLayout,
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
MultiSelect.parameters = {
  colorScheme: "dark",
  mockLayouts: Array(8)
    .fill(undefined)
    .map((_, idx) => ({
      id: `layout-${idx + 1}`,
      name: `Layout ${idx + 1}`,
      baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, updatedAt: new Date(10).toISOString() },
    })),
};
MultiSelect.play = async () => {
  const layouts = await screen.findAllByTestId("layout-list-item");
  const user = userEvent.setup();

  await user.click(layouts[0]!);

  await user.keyboard("{Meta>}");
  await user.click(layouts[1]!);
  await user.click(layouts[3]!);
  await user.keyboard("{/Meta}");

  await user.keyboard("{Shift>}");
  await user.click(layouts[6]!);
  await user.keyboard("{/Shift}");

  await user.keyboard("{Meta>}");
  await user.click(layouts[4]!);
  await user.keyboard("{/Meta}");
};

export function MultiDelete(): JSX.Element {
  return <LayoutBrowser />;
}
MultiDelete.parameters = { colorScheme: "dark" };
MultiDelete.play = async () => {
  await doMultiAction("Delete");

  const confirmButton = await screen.findByText("Delete");
  fireEvent.click(confirmButton);
};

export function MultiDuplicate(): JSX.Element {
  return <LayoutBrowser />;
}
MultiDuplicate.parameters = {
  colorScheme: "dark",
  mockLayouts: [exampleCurrentLayout, makeUnsavedLayout(1), shortLayout],
};
MultiDuplicate.play = async () => {
  await doMultiAction("Duplicate");
};

export function MultiRevert(): JSX.Element {
  return <LayoutBrowser />;
}
MultiRevert.parameters = {
  colorScheme: "dark",
  mockLayouts: [makeUnsavedLayout(1), makeUnsavedLayout(2), makeUnsavedLayout(3)],
};
MultiRevert.play = async () => {
  await doMultiAction("Revert");

  const revertButton = await screen.findByText("Discard changes");
  fireEvent.click(revertButton);
};

export function MultiSave(): JSX.Element {
  return <LayoutBrowser />;
}
MultiSave.parameters = {
  colorScheme: "dark",
  mockLayouts: [makeUnsavedLayout(1), makeUnsavedLayout(2), makeUnsavedLayout(3)],
};
MultiSave.play = async () => {
  await doMultiAction("Save changes");
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
  if (layouts[0]) {
    fireEvent.click(layouts[0]);
  }
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
