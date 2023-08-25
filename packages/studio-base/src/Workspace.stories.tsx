// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent, screen } from "@storybook/testing-library";
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
              const [droppedPath, setDroppedPath] = useState<DraggedMessagePath | undefined>();
              useEffect(() => {
                setMessagePathDropConfig({
                  getDropStatus(_path) {
                    return { canDrop: true, message: "Example drop message" };
                  },
                  handleDrop(path) {
                    setDroppedPath(path);
                  },
                });
              }, [setMessagePathDropConfig]);
              return (
                <>
                  <PanelToolbar />
                  <div>Drop here!</div>
                  {droppedPath && (
                    <>
                      <div>
                        Path: <code>{droppedPath.path}</code>
                      </div>
                      <div>
                        Root schema name: <code>{droppedPath.rootSchemaName}</code>
                      </div>
                    </>
                  )}
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
