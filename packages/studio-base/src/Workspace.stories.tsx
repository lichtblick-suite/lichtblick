// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent, screen, waitFor } from "@storybook/testing-library";
import { useEffect, useState } from "react";

import { DraggedMessagePath } from "@foxglove/studio";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import Tab from "@foxglove/studio-base/panels/Tab";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

import Workspace from "./Workspace";

export default {
  title: "Workspace",
  component: Workspace,
  parameters: {
    colorScheme: "light",
  },
};

class MockPanelCatalog implements PanelCatalog {
  static #fakePanel: PanelInfo = {
    title: "Fake Panel",
    type: "Fake",
    module: async () => {
      return {
        default: Panel(
          Object.assign(
            () => (
              <>
                <PanelToolbar />
                <div>I’m a fake panel</div>
              </>
            ),
            { panelType: "Fake", defaultConfig: {} },
          ),
        ),
      };
    },
  };

  static #droppablePanel: PanelInfo = {
    title: "Droppable Panel",
    type: "Droppable",
    module: async () => {
      return {
        default: Panel(
          Object.assign(
            function DroppablePanel() {
              const { setMessagePathDropConfig } = usePanelContext();
              const [droppedPaths, setDroppedPaths] = useState<
                readonly DraggedMessagePath[] | undefined
              >();
              useEffect(() => {
                setMessagePathDropConfig({
                  getDropStatus(_paths) {
                    return { canDrop: true, message: "Example drop message" };
                  },
                  handleDrop(paths) {
                    setDroppedPaths(paths);
                  },
                });
              }, [setMessagePathDropConfig]);
              return (
                <>
                  <PanelToolbar />
                  <div>Drop here!</div>
                  {droppedPaths && <pre>{JSON.stringify(droppedPaths, undefined, 2)}</pre>}
                </>
              );
            },
            { panelType: "Droppable", defaultConfig: {} },
          ),
        ),
      };
    },
  };

  public getPanels(): readonly PanelInfo[] {
    return [
      MockPanelCatalog.#fakePanel,
      MockPanelCatalog.#droppablePanel,
      { title: "Tab", type: "Tab", module: async () => ({ default: Tab }) },
    ];
  }
  public getPanelByType(type: string): PanelInfo | undefined {
    return this.getPanels().find((panel) => panel.type === type);
  }
}

export const Basic: StoryObj<{ initialLayoutState: Partial<LayoutData> }> = {
  args: {
    initialLayoutState: { layout: "Fake" },
  },
  render: (args) => {
    const fixture: Fixture = {
      topics: [{ name: "foo", schemaName: "test.Foo" }],
      datatypes: new Map([
        [
          "test.Foo",
          {
            definitions: [
              { name: "bar", type: "string" },
              { name: "baz", type: "string" },
            ],
          },
        ],
      ]),
    };
    const providers = [
      /* eslint-disable react/jsx-key */
      <PanelSetup fixture={fixture}>{undefined}</PanelSetup>,
      <EventsProvider />,
      <PanelCatalogContext.Provider value={new MockPanelCatalog()} />,
      <MockCurrentLayoutProvider initialState={args.initialLayoutState} />,
      /* eslint-enable react/jsx-key */
    ];
    return (
      <MultiProvider providers={providers}>
        <Workspace disablePersistenceForStorybook />
      </MultiProvider>
    );
  },
};

export const Chinese: typeof Basic = {
  ...Basic,
  parameters: { forceLanguage: "zh" },
};

export const Japanese: typeof Basic = {
  ...Basic,
  parameters: { forceLanguage: "ja" },
};

export const FullscreenPanel: typeof Basic = {
  ...Basic,
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
    fireEvent.click(await screen.findByTestId("panel-menu-fullscreen"));
  },
};

export const DragTopicStart: typeof Basic = {
  ...Basic,
  args: {
    initialLayoutState: {
      layout: {
        direction: "column",
        first: "Fake",
        second: "Tab!a",
      },
      configById: {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [
            { title: "Tab A", layout: { direction: "row", first: "Fake", second: "Droppable" } },
          ],
        },
      },
    },
  },
  play: async () => {
    fireEvent.click(await screen.findByText("Topics"));

    const handle = await screen.findByTestId("TopicListDragHandle");
    fireEvent.dragStart(handle);
  },
};

export const DragTopicOver: typeof Basic = {
  ...DragTopicStart,
  play: async () => {
    fireEvent.click(await screen.findByText("Topics"));

    const handle = await screen.findByTestId("TopicListDragHandle");
    fireEvent.dragStart(handle);
    const dest = await screen.findByText("Drop here!");
    fireEvent.dragOver(dest);
  },
};

export const DragTopicDrop: typeof Basic = {
  ...DragTopicStart,
  play: async () => {
    fireEvent.click(await screen.findByText("Topics"));

    const handle = await screen.findByTestId("TopicListDragHandle");
    fireEvent.dragStart(handle);
    const dest = await screen.findByText("Drop here!");
    fireEvent.dragOver(dest);
    fireEvent.drop(dest);
  },
};

export const DragPathDrop: typeof Basic = {
  ...DragTopicStart,
  play: async () => {
    fireEvent.click(await screen.findByText("Topics"));
    fireEvent.change(await screen.findByPlaceholderText("Filter by topic or schema name…"), {
      target: { value: "foobar" },
    });
    const handle = await waitFor(async () => {
      const handles = await screen.findAllByTestId("TopicListDragHandle");
      if (handles.length < 2) {
        throw new Error("Expected 2 drag handles");
      }
      return handles[1]!;
    });
    fireEvent.dragStart(handle);
    const dest = await screen.findByText("Drop here!");
    fireEvent.dragOver(dest);
    fireEvent.drop(dest);
  },
};

export const DragMultipleItems: typeof Basic = {
  ...DragTopicStart,
  play: async () => {
    fireEvent.click(await screen.findByText("Topics"));
    fireEvent.change(await screen.findByPlaceholderText("Filter by topic or schema name…"), {
      target: { value: "fooba" },
    });
    fireEvent.click(
      await screen.findByText(
        (_content, element) => element instanceof HTMLSpanElement && element.textContent === ".bar",
      ),
    );
    fireEvent.click(
      await screen.findByText(
        (_content, element) => element instanceof HTMLSpanElement && element.textContent === ".baz",
      ),
      { metaKey: true },
    );
    const handle = await waitFor(async () => {
      const handles = await screen.findAllByTestId("TopicListDragHandle");
      if (handles.length < 3) {
        throw new Error("Expected 3 drag handles");
      }
      return handles[2]!;
    });
    fireEvent.dragStart(handle);
    const dest = await screen.findByText("Drop here!");
    fireEvent.dragOver(dest);
    fireEvent.drop(dest);
  },
};
