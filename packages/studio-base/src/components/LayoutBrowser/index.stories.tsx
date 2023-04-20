// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj, StoryContext, StoryFn } from "@storybook/react";
import { fireEvent, screen, userEvent, within } from "@storybook/testing-library";
import { useMemo } from "react";

import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import CurrentUserContext from "@foxglove/studio-base/context/CurrentUserContext";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import { UserProfileStorageContext } from "@foxglove/studio-base/context/UserProfileStorageContext";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";
import { ISO8601Timestamp, Layout, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager/LayoutManager";
import MockLayoutStorage from "@foxglove/studio-base/services/MockLayoutStorage";

import LayoutBrowser from "./index";

const DEFAULT_LAYOUT_FOR_TESTS: LayoutData = {
  configById: {},
  globalVariables: {},
  userNodes: {},
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

function WithSetup(Child: StoryFn, ctx: StoryContext): JSX.Element {
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
      <UserProfileStorageContext.Provider value={userProfile}>
        <LayoutStorageContext.Provider value={storage}>
          <LayoutManagerProvider>
            <CurrentLayoutProvider>
              <Child />
            </CurrentLayoutProvider>
          </LayoutManagerProvider>
        </LayoutStorageContext.Provider>
      </UserProfileStorageContext.Provider>
    </div>
  );
}

export default {
  title: "components/LayoutBrowser",
  component: LayoutBrowser,
  decorators: [WithSetup],
};

export const Empty: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { mockLayouts: [] },
};

export const LayoutList: StoryObj = {
  render: () => {
    return <LayoutBrowser />;
  },
};

export const MultiSelect: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: {
    colorScheme: "dark",
    mockLayouts: Array(8)
      .fill(undefined)
      .map((_, idx) => ({
        id: `layout-${idx + 1}`,
        name: `Layout ${idx + 1}`,
        baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, updatedAt: new Date(10).toISOString() },
      })),
  },

  play: async ({ canvasElement }) => {
    const layouts = await within(canvasElement).findAllByTestId("layout-list-item");

    userEvent.click(layouts[0]!);

    userEvent.click(layouts[1]!, { metaKey: true });
    userEvent.click(layouts[3]!, { metaKey: true });

    userEvent.click(layouts[6]!, { shiftKey: true });

    userEvent.click(layouts[4]!, { metaKey: true });
  },
};

export const MultiDelete: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    await doMultiAction("Delete");

    const confirmButton = await screen.findByText("Delete");
    fireEvent.click(confirmButton);
  },
};

export const MultiDuplicate: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: {
    colorScheme: "dark",
    mockLayouts: [exampleCurrentLayout, makeUnsavedLayout(1), shortLayout],
  },

  play: async () => {
    await doMultiAction("Duplicate");
  },
};

export const MultiRevert: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: {
    colorScheme: "dark",
    mockLayouts: [makeUnsavedLayout(1), makeUnsavedLayout(2), makeUnsavedLayout(3)],
  },

  play: async () => {
    await doMultiAction("Revert");

    const revertButton = await screen.findByText("Discard changes");
    fireEvent.click(revertButton);
  },
};

export const MultiSave: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: {
    colorScheme: "dark",
    mockLayouts: [makeUnsavedLayout(1), makeUnsavedLayout(2), makeUnsavedLayout(3)],
  },

  play: async () => {
    await doMultiAction("Save changes");
  },
};

export const TruncatedLayoutName: StoryObj = {
  render: () => {
    return <LayoutBrowser />;
  },
  parameters: {
    mockLayouts: [
      {
        id: "not-current",
        name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, updatedAt: new Date(10).toISOString() },
      },
    ],
  },
};

export const TruncatedLayoutNameSelected: StoryObj = {
  render: () => {
    return <LayoutBrowser />;
  },
  parameters: {
    mockLayouts: [
      {
        id: "test-id",
        name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, updatedAt: new Date(10).toISOString() },
      },
    ],
  },
};

export const AddLayout: StoryObj = {
  render: function Story() {
    return (
      <LayoutBrowser
        currentDateForStorybook={useMemo(() => new Date("2021-06-16T04:28:33.549Z"), [])}
      />
    );
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    const button = await screen.findByTestId("add-layout");
    fireEvent.click(button);
  },
};

export const MenuOpen: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    const actions = await screen.findAllByTestId("layout-actions");
    if (actions[1]) {
      fireEvent.click(actions[1]);
    }
  },
};

export const MenuOpenLight: StoryObj = {
  ...MenuOpen,
  parameters: { colorScheme: "light" },
  play: async () => {
    const actions = await screen.findAllByTestId("layout-actions");
    if (actions[1]) {
      fireEvent.click(actions[1]);
    }
  },
};

export const EditingName: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    const actions = await screen.findAllByTestId("layout-actions");
    if (actions[1]) {
      fireEvent.click(actions[1]);
    }
    const button = await screen.findByText("Rename");
    fireEvent.click(button);
  },
};

export const CancelRenameWithEscape: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    const actions = await screen.findAllByTestId("layout-actions");
    if (actions[1]) {
      fireEvent.click(actions[1]);
    }
    const button = await screen.findByText("Rename");
    fireEvent.click(button);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  },
};

export const CommitRenameWithTab: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    const actions = await screen.findAllByTestId("layout-actions");
    if (actions[1]) {
      fireEvent.click(actions[1]);
    }
    const button = await screen.findByText("Rename");
    fireEvent.click(button);
    fireEvent.change(document.activeElement!, { target: { value: "New name" } });
    fireEvent.focusOut(document.activeElement!);
  },
};

export const Duplicate: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },

  play: async () => {
    const actions = await screen.findAllByTestId("layout-actions");
    if (actions[1]) {
      fireEvent.click(actions[1]);
    }
    const button = await screen.findByText("Duplicate");
    fireEvent.click(button);
  },
};

export const DeleteLayout: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: { colorScheme: "dark" },
  play: async () => await deleteLayoutInteraction(0),
};

export const DeleteSelectedLayout: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  play: async () => {
    const layouts = await screen.findAllByTestId("layout-list-item");
    if (layouts[1]) {
      fireEvent.click(layouts[1]);
    }
    await deleteLayoutInteraction(1);
    if (layouts[0]) {
      fireEvent.click(layouts[0]);
    }
  },

  parameters: { colorScheme: "dark" },
};

export const DeleteLastLayout: StoryObj = {
  render: function Story() {
    return <LayoutBrowser />;
  },

  parameters: {
    mockLayouts: [exampleCurrentLayout],
    colorScheme: "dark",
  },

  play: async () => await deleteLayoutInteraction(0),
};

export const SignInPrompt: StoryObj = {
  render: function Story() {
    return (
      <CurrentUserContext.Provider
        value={{
          currentUser: undefined,
          signIn: () => undefined,
          signOut: async () => undefined,
        }}
      >
        <WorkspaceContextProvider>
          <LayoutBrowser />
        </WorkspaceContextProvider>
      </CurrentUserContext.Provider>
    );
  },

  parameters: {
    colorScheme: "light",
  },
};
