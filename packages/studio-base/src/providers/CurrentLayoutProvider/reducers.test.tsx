// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { renderHook, act } from "@testing-library/react-hooks";
import { getLeaves, MosaicNode, MosaicParent } from "react-mosaic-component";

import CurrentLayoutContext, {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  CreateTabPanelPayload,
  PanelsState,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import { TabPanelConfig } from "@foxglove/studio-base/types/layouts";
import { MosaicDropTargetPosition } from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import { defaultPlaybackConfig } from "./reducers";

function renderProvider() {
  const currentLayout = new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS);
  const { result } = renderHook(
    () => ({
      selectedId: useCurrentLayoutSelector((state) => state.selectedLayout?.id),
      state: useCurrentLayoutSelector((state) => state.selectedLayout?.data),
      actions: useCurrentLayoutActions(),
      selectedPanels: useSelectedPanels(),
    }),
    {
      wrapper({ children }) {
        return (
          <CurrentLayoutContext.Provider value={currentLayout}>
            {children}
          </CurrentLayoutContext.Provider>
        );
      },
    },
  );

  return { result };
}

describe("layout reducers", () => {
  it("doesn't publish updates when new state is equal to old state", () => {
    const { result } = renderProvider();

    expect(result.all.length).toBe(1);
    result.current.actions.setPlaybackConfig({ speed: 1 });
    expect(result.all.length).toBe(1);
  });

  describe("adds panel to a layout", () => {
    it("adds panel to main app layout", () => {
      const { result } = renderProvider();
      const panelLayout = {
        layout: "Tab!a",
        configById: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.addPanel({
          id: "Audio!x",
          tabId: undefined,
          config: { foo: "bar" },
        });
      });
      const panels = result.current.state!;
      const layout = panels.layout as MosaicParent<string>;
      const firstStr = layout.first as string;
      const secondStr = layout.second as string;
      expect(layout.direction).toEqual("row");
      expect(firstStr).toEqual("Audio!x");
      expect(layout.second).toEqual("Tab!a");

      expect(panels.configById[firstStr]).toEqual({ foo: "bar" });
      expect(panels.configById[secondStr]).toEqual(panelLayout.configById["Tab!a"]);
    });
    it("adds panel to empty Tab layout", () => {
      const { result } = renderProvider();
      const panelLayout = {
        layout: "Tab!a",
        configById: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.addPanel({
          id: "Audio!x",
          tabId: "Tab!a",
          config: { foo: "bar" },
        });
      });

      const { layout, configById } = result.current.state!;
      const tabs = (configById["Tab!a"] as TabPanelConfig).tabs;
      const newAudioId = tabs[0]!.layout as string;
      expect(layout).toEqual("Tab!a");
      expect(configById["Tab!a"]?.activeTabIdx).toEqual(0);
      expect(tabs[0]!.title).toEqual("A");
      expect(newAudioId).toEqual("Audio!x");
      expect(tabs.length).toEqual(3);

      expect(configById[newAudioId]).toEqual({ foo: "bar" });
      expect(configById[layout as string]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "A", layout: newAudioId }, { title: "B" }, { title: "C" }],
      });
    });
  });

  describe("drops panel into a layout", () => {
    it("drops panel into app layout", () => {
      const { result } = renderProvider();
      const panelLayout = {
        layout: "Tab!a",
        configById: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.dropPanel({
          newPanelType: "Audio",
          destinationPath: [],
          position: "right",
          config: { foo: "bar" },
          relatedConfigs: undefined,
        });
      });
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(layout.direction).toEqual("row");
      expect(layout.first).toEqual("Tab!a");
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
    });
    it("drops Tab panel into app layout", () => {
      const { result } = renderProvider();
      const panelLayout = { layout: "Audio!a", configById: { "Audio!a": { foo: "bar" } } };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.dropPanel({
          newPanelType: "Tab",
          destinationPath: [],
          position: "right",
          config: { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!b" }] },
          relatedConfigs: { "Audio!b": { foo: "baz" } },
        });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(layout.direction).toEqual("row");
      expect(layout.first).toEqual("Audio!a");
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Tab");

      expect(configById["Audio!a"]).toEqual({ foo: "bar" });
      const { activeTabIdx, tabs } = configById[layout.second as string] as TabPanelConfig;
      expect(activeTabIdx).toEqual(0);
      expect(tabs.length).toEqual(1);
      expect(tabs[0]?.title).toEqual("A");

      const newAudioId = tabs[0]?.layout as string;
      expect(getPanelTypeFromId(newAudioId)).toEqual("Audio");
      expect(configById[newAudioId]).toEqual({ foo: "baz" });
    });
    it("drops panel into empty Tab layout", () => {
      const { result } = renderProvider();
      const panelLayout = {
        layout: "Tab!a",
        configById: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.dropPanel({
          newPanelType: "Audio",
          destinationPath: [],
          position: "right",
          tabId: "Tab!a",
          config: { foo: "bar" },
          relatedConfigs: undefined,
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual("Tab!a");
      const tabs = (configById["Tab!a"] as TabPanelConfig).tabs;
      expect(tabs[0]!.title).toEqual("A");
      expect(getPanelTypeFromId(tabs[0]!.layout as string)).toEqual("Audio");
      expect(tabs.length).toEqual(3);
    });
    it("drops panel into nested Tab layout", () => {
      const { result } = renderProvider();
      const panelLayout = {
        layout: "Tab!a",
        configById: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: "Tab!b" }] },
          "Tab!b": { activeTabIdx: 0, tabs: [{ title: "B", layout: "Plot!a" }] },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.dropPanel({
          newPanelType: "Audio",
          destinationPath: [],
          position: "right",
          tabId: "Tab!b",
          config: { foo: "bar" },
          relatedConfigs: undefined,
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual("Tab!a");
      expect(configById["Tab!a"]).toEqual(panelLayout.configById["Tab!a"]);
      const tabBTabs = (configById["Tab!b"] as TabPanelConfig).tabs;
      expect(tabBTabs.length).toEqual(1);
      expect((tabBTabs[0]!.layout as MosaicParent<string>).first).toEqual("Plot!a");
      expect(
        getPanelTypeFromId((tabBTabs[0]!.layout as MosaicParent<string>).second as string),
      ).toEqual("Audio");
      expect(configById[(tabBTabs[0]!.layout as MosaicParent<string>).second as string]).toEqual({
        foo: "bar",
      });
    });
    it("drops nested Tab panel into main layout", () => {
      const { result } = renderProvider();
      const panelLayout = { layout: "Audio!a" };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.dropPanel({
          newPanelType: "Tab",
          destinationPath: [],
          position: "right",
          config: { activeTabIdx: 0, tabs: [{ title: "A", layout: "Tab!b" }] },
          relatedConfigs: {
            "Tab!b": { activeTabIdx: 0, tabs: [{ title: "B", layout: "Plot!a" }] },
          },
        });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(layout.first).toEqual("Audio!a");
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Tab");

      const parentTabConfig = configById[layout.second as string] as TabPanelConfig;
      expect(parentTabConfig.tabs.length).toEqual(1);
      expect(parentTabConfig.tabs[0]!.title).toEqual("A");

      const childTabId = parentTabConfig.tabs[0]!.layout as string;
      expect(getPanelTypeFromId(childTabId)).toEqual("Tab");
      const childTabProps = configById[childTabId] as TabPanelConfig;
      expect(childTabProps?.activeTabIdx).toEqual(0);
      expect(childTabProps?.tabs.length).toEqual(1);
      expect(childTabProps?.tabs[0]!.title).toEqual("B");
      expect(getPanelTypeFromId(childTabProps?.tabs[0]!.layout as string)).toEqual("Plot");
    });
  });

  describe("moves tabs", () => {
    it("reorders tabs within a Tab panel", () => {
      const { result } = renderProvider();
      const panelLayout = {
        layout: "Tab!a",
        configById: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.moveTab({
          source: { panelId: "Tab!a", tabIndex: 0 },
          target: { panelId: "Tab!a", tabIndex: 1 },
        });
      });
      const { configById } = result.current.state!;
      expect(configById).toEqual({
        "Tab!a": { activeTabIdx: 1, tabs: [{ title: "B" }, { title: "A" }, { title: "C" }] },
      });
    });

    it("moves tabs between Tab panels", () => {
      const { result } = renderProvider();
      const layout: MosaicParent<string> = { first: "Tab!a", second: "Tab!b", direction: "row" };
      const panelLayout = {
        layout,
        configById: {
          "Tab!a": {
            activeTabIdx: 0,
            tabs: [{ title: "A" }, { title: "B" }, { title: "C" }],
          },
          "Tab!b": {
            activeTabIdx: 0,
            tabs: [{ title: "D" }, { title: "E" }, { title: "F" }],
          },
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
        result.current.actions.moveTab({
          source: { panelId: "Tab!a", tabIndex: 0 },
          target: { panelId: "Tab!b", tabIndex: 1 },
        });
      });
      const { configById } = result.current.state!;
      expect(configById).toEqual({
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "B" }, { title: "C" }] },
        "Tab!b": {
          activeTabIdx: 0,
          tabs: [{ title: "D" }, { title: "A" }, { title: "E" }, { title: "F" }],
        },
      });
    });
  });

  it("closes a panel in single-panel layout", () => {
    const { result } = renderProvider();
    act(() => {
      result.current.actions.setSelectedLayout({
        id: "X" as LayoutID,
        data: {
          layout: "Audio!a",
          configById: { "Audio!a": { foo: "bar" } },
        },
      });
      result.current.selectedPanels.setSelectedPanelIds(["Audio!a", "unknown!b"]);
      result.current.actions.closePanel({ root: "Audio!a", path: [] });
    });
    const { layout, configById } = result.current.state!;
    expect(layout).toEqual(undefined);
    expect(configById).toEqual({});
    expect(result.current.selectedPanels.selectedPanelIds).toEqual(["unknown!b"]);
  });

  it("closes a panel in multi-panel layout", () => {
    const { result } = renderProvider();
    const layout: MosaicParent<string> = { first: "Audio!a", second: "Audio!b", direction: "row" };
    const panelLayout = {
      layout,
      configById: { "Audio!a": { foo: "bar" }, "Audio!b": { foo: "baz" } },
    };
    act(() => {
      result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
      result.current.selectedPanels.setSelectedPanelIds(["Audio!a", "Audio!b"]);
      result.current.actions.closePanel({ root: panelLayout.layout, path: ["first"] });
    });
    expect(result.current.state!.layout).toEqual("Audio!b");
    expect(result.current.state!.configById).toEqual({ "Audio!b": { foo: "baz" } });
    expect(result.current.selectedPanels.selectedPanelIds).toEqual(["Audio!b"]);
  });

  it("closes a panel nested inside a Tab panel", () => {
    const { result } = renderProvider();
    const panelLayout = {
      layout: "Tab!a",
      configById: {
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] },
        "Audio!a": { foo: "bar" },
      },
    };
    act(() => {
      result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelLayout });
      result.current.selectedPanels.setSelectedPanelIds(["Audio!a"]);
      result.current.actions.closePanel({ root: "Audio!a", path: [], tabId: "Tab!a" });
    });
    expect(result.current.state!.layout).toEqual("Tab!a");
    expect(result.current.state!.configById).toEqual({
      "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: undefined }] },
    });
    expect(result.current.selectedPanels.selectedPanelIds).toEqual([]);
  });

  it("loads a layout", () => {
    const { result } = renderProvider();
    const panelsState: Partial<PanelsState> = { layout: "foo" };
    act(() => {
      result.current.actions.setSelectedLayout({ id: "X" as LayoutID, data: panelsState });
    });
    expect(result.current.selectedId).toEqual("X");
    expect(result.current.state!.layout).toEqual("foo");
  });

  it("resets panels to a valid state when importing an empty layout", () => {
    const { result } = renderProvider();
    act(() => {
      result.current.actions.setSelectedLayout({
        id: "X" as LayoutID,
        data: { layout: undefined },
      });
    });
    expect(result.current.selectedId).toEqual("X");
    expect(result.current.state).toEqual({
      globalVariables: {},
      layout: undefined,
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
      configById: {},
      userNodes: {},
    });
  });

  describe("creates Tab panels from existing panels correctly", () => {
    const regularLayoutPayload: Partial<PanelsState> & { layout: MosaicNode<string> } = {
      layout: {
        first: "Audio!a",
        second: { first: "RawMessages!a", second: "Audio!c", direction: "column" },
        direction: "row",
      },
      configById: { "Audio!a": { foo: "bar" }, "RawMessages!a": { foo: "baz" } },
    };
    const basePayload = {
      idToReplace: "Audio!a",
      newId: "Tab!a",
      idsToRemove: ["Audio!a", "RawMessages!a"],
      singleTab: false,
    };
    const nestedLayoutPayload: Partial<PanelsState> & { layout: MosaicNode<string> } = {
      layout: {
        first: "Audio!a",
        second: "Tab!z",
        direction: "column",
      },
      configById: {
        "Audio!a": { foo: "bar" },
        "Tab!z": {
          activeTabIdx: 0,
          tabs: [
            {
              title: "First tab",
              layout: { first: "Audio!b", second: "RawMessages!a", direction: "row" },
            },
          ],
        },
        "Audio!b": { foo: "baz" },
        "RawMessages!a": { raw: "messages" },
      },
    };
    const createTabPanelPayload: CreateTabPanelPayload = {
      ...basePayload,
      layout: regularLayoutPayload.layout,
    };
    const nestedCreateTabPanelPayload: CreateTabPanelPayload = {
      ...basePayload,
      layout: nestedLayoutPayload.layout,
    };

    it("will group selected panels into a Tab panel", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: regularLayoutPayload,
        });
        result.current.actions.createTabPanel({ ...createTabPanelPayload, singleTab: true });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
      expect(configById[layout.first as string]).toEqual({
        activeTabIdx: 0,
        tabs: [
          {
            title: "1",
            layout: { direction: "row", first: "Audio!a", second: "RawMessages!a" },
          },
        ],
      });
      expect(configById[layout.second as string]).toEqual(
        regularLayoutPayload.configById?.[layout.second as string],
      );
    });

    it("will group selected panels into a Tab panel, even when a selected panel is nested", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: nestedLayoutPayload,
        });
        result.current.actions.createTabPanel({ ...nestedCreateTabPanelPayload, singleTab: true });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
      expect(getPanelTypeFromId(layout.second as string)).toEqual(TAB_PANEL_TYPE);
      expect(configById[layout.first as string]).toEqual({
        activeTabIdx: 0,
        tabs: [
          {
            title: "1",
            layout: { direction: "column", first: "Audio!a", second: "RawMessages!a" },
          },
        ],
      });
      expect(configById[layout.second as string]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "First tab", layout: "Audio!b" }],
      });
    });

    it("will create individual tabs for selected panels in a new Tab panel", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: regularLayoutPayload,
        });
        result.current.actions.createTabPanel({ ...createTabPanelPayload, singleTab: false });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
      expect(configById[layout.first as string]).toEqual({
        activeTabIdx: 0,
        tabs: [
          { title: "Audio", layout: "Audio!a" },
          { title: "RawMessages", layout: "RawMessages!a" },
        ],
      });
      expect(configById[layout.second as string]).toEqual(
        regularLayoutPayload.configById?.[layout.second as string],
      );
    });

    it("will create individual tabs for selected panels in a new Tab panel, even when a selected panel is nested", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: nestedLayoutPayload,
        });
        result.current.actions.createTabPanel({ ...nestedCreateTabPanelPayload, singleTab: false });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
      expect(getPanelTypeFromId(layout.second as string)).toEqual(TAB_PANEL_TYPE);
      expect(configById[layout.first as string]).toEqual({
        activeTabIdx: 0,
        tabs: [
          { title: "Audio", layout: "Audio!a" },
          { title: "RawMessages", layout: "RawMessages!a" },
        ],
      });
      expect(configById[layout.second as string]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "First tab", layout: "Audio!b" }],
      });
    });
  });

  it("saves and overwrites user nodes", () => {
    const { result } = renderProvider();
    const firstPayload = { foo: { name: "foo", sourceCode: "bar" } };
    const secondPayload = { bar: { name: "bar", sourceCode: "baz" } };

    act(() => {
      result.current.actions.setUserNodes(firstPayload);
    });
    expect(result.current.state!.userNodes).toEqual(firstPayload);

    act(() => {
      result.current.actions.setUserNodes(secondPayload);
    });
    expect(result.current.state!.userNodes).toEqual({ ...firstPayload, ...secondPayload });
  });

  describe("panel toolbar actions", () => {
    it("can split panel", () => {
      const { result } = renderProvider();
      const audioConfig = { foo: "bar" };
      act(() => {
        result.current.actions.changePanelLayout({ layout: "Audio!a" });

        result.current.actions.savePanelConfigs({
          configs: [{ id: "Audio!a", config: audioConfig }],
        });

        result.current.actions.splitPanel({
          id: "Audio!a",
          config: audioConfig,
          direction: "row",
          path: [],
          root: "Audio!a",
        });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(layout.first).toEqual("Audio!a");
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
      expect(layout.direction).toEqual("row");
      expect(configById["Audio!a"]).toEqual(audioConfig);
      expect(configById[layout.second as string]).toEqual(audioConfig);
    });

    it("can split Tab panel", () => {
      const { result } = renderProvider();
      const audioConfig = { foo: "bar" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] };
      act(() => {
        result.current.actions.changePanelLayout({ layout: "Tab!a" });

        result.current.actions.savePanelConfigs({
          configs: [
            { id: "Tab!a", config: tabConfig },
            { id: "Audio!a", config: audioConfig },
          ],
        });

        result.current.actions.splitPanel({
          id: "Tab!a",
          config: tabConfig,
          direction: "row",
          path: [],
          root: "Tab!a",
        });
      });

      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as MosaicParent<string>;
      expect(layout.first).toEqual("Tab!a");
      expect(getPanelTypeFromId(layout.second as string)).toEqual("Tab");
      expect(layout.direction).toEqual("row");
      expect(configById["Tab!a"]).toEqual(tabConfig);
      expect(
        getPanelTypeFromId(
          (configById[layout.second as string] as TabPanelConfig)?.tabs[0]!.layout as string,
        ),
      ).toEqual("Audio");
      expect(configById["Audio!a"]).toEqual(audioConfig);
    });

    it("can split panel inside Tab panel", () => {
      const { result } = renderProvider();
      const audioConfig = { foo: "bar" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] };
      act(() => {
        result.current.actions.changePanelLayout({ layout: "Tab!a" });

        result.current.actions.savePanelConfigs({
          configs: [
            { id: "Tab!a", config: tabConfig },
            { id: "Audio!a", config: audioConfig },
          ],
        });

        result.current.actions.splitPanel({
          id: "Audio!a",
          tabId: "Tab!a",
          config: audioConfig,
          direction: "row",
          path: [],
          root: "Audio!a",
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual("Tab!a");
      const tabLayout = (configById["Tab!a"] as TabPanelConfig).tabs[0]!
        .layout! as MosaicParent<string>;
      expect(tabLayout.first).toEqual("Audio!a");
      expect(getPanelTypeFromId(tabLayout.second as string)).toEqual("Audio");
      expect(tabLayout.direction).toEqual("row");
      expect(configById["Audio!a"]).toEqual(audioConfig);
      expect(configById[tabLayout.second as string]).toEqual(audioConfig);
    });

    it("can swap panels", () => {
      const { result } = renderProvider();
      const audioConfig = { foo: "bar" };
      const rawMessagesConfig = { foo: "baz" };
      act(() => {
        result.current.actions.changePanelLayout({ layout: "Audio!a" });
        result.current.actions.savePanelConfigs({
          configs: [{ id: "Audio!a", config: audioConfig }],
        });

        result.current.actions.swapPanel({
          originalId: "Audio!a",
          type: "RawMessages",
          config: rawMessagesConfig,
          path: [],
          root: "Audio!a",
        });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as string;
      expect(getPanelTypeFromId(layout)).toEqual("RawMessages");
      expect(configById["Audio!a"]).toEqual(undefined);
      expect(configById[layout]).toEqual(rawMessagesConfig);
    });

    it("can swap panel for a Tab panel", () => {
      const { result } = renderProvider();
      const audioConfig = { foo: "bar" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "RawMessages!a" }] };
      const rawMessagesConfig = { path: "foo" };
      act(() => {
        result.current.actions.changePanelLayout({ layout: "Audio!a" });

        result.current.actions.savePanelConfigs({
          configs: [{ id: "Audio!a", config: audioConfig }],
        });

        result.current.actions.swapPanel({
          originalId: "Audio!a",
          type: "Tab",
          config: tabConfig,
          relatedConfigs: { "RawMessages!a": rawMessagesConfig },
          path: [],
          root: "Audio!a",
        });
      });
      const { configById } = result.current.state!;
      const layout = result.current.state!.layout as string;
      expect(getPanelTypeFromId(layout)).toEqual("Tab");
      const tabLayout = (configById[layout] as TabPanelConfig).tabs[0]!.layout!;
      expect(getPanelTypeFromId(tabLayout as string)).toEqual("RawMessages");
      expect(configById[tabLayout as string]).toEqual(rawMessagesConfig);
    });

    it("can swap panel inside a Tab", () => {
      const { result } = renderProvider();
      const rawMessagesConfig = { foo: "baz" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] };

      act(() => {
        result.current.actions.changePanelLayout({ layout: "Tab!a" });

        result.current.actions.savePanelConfigs({
          configs: [{ id: "Tab!a", config: tabConfig }],
        });
        result.current.actions.swapPanel({
          originalId: "Audio!a",
          tabId: "Tab!a",
          type: "RawMessages",
          config: rawMessagesConfig,
          path: [],
          root: "Audio!a",
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual("Tab!a");
      const tabLayout = (configById["Tab!a"] as TabPanelConfig)!.tabs[0]!.layout!;
      expect(getPanelTypeFromId(tabLayout as string)).toEqual("RawMessages");
      expect(configById[tabLayout as string]).toEqual(rawMessagesConfig);
    });
  });

  describe("clearing old saved config", () => {
    const panelState = {
      layout: {
        direction: "row",
        first: "FirstPanel!34otwwt",
        second: {
          direction: "column",
          second: "SecondPanel!2wydzut",
          first: { direction: "row", second: "ThirdPanel!ye6m1m", first: "FourthPanel!abc" },
        },
      },
      configById: {},
    } as PanelsState;
    const tabPanelState = {
      layout: {
        direction: "row",
        first: "FirstPanel!34otwwt",
        second: {
          direction: "column",
          second: "SecondPanel!2wydzut",
          first: { direction: "row", second: "ThirdPanel!ye6m1m", first: "Tab!abc" },
        },
      },
      configById: {},
    } as PanelsState;

    it("removes a panel's configById when it is removed from the layout", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.changePanelLayout({ layout: panelState.layout });
      });
      // eslint-disable-next-line no-restricted-syntax
      const leaves = getLeaves(panelState.layout ?? null);
      expect(leaves).toHaveLength(4);
      expect(leaves).toContain("FirstPanel!34otwwt");
      expect(leaves).toContain("SecondPanel!2wydzut");
      expect(leaves).toContain("ThirdPanel!ye6m1m");
      expect(leaves).toContain("FourthPanel!abc");
      expect(result.current.state!.configById).toEqual({});

      const panelConfig = {
        id: "SecondPanel!2wydzut",
        config: { foo: "bar" },
        defaultConfig: { foo: "" },
      };
      act(() => {
        result.current.actions.savePanelConfigs({
          configs: [
            panelConfig,
            { id: "FirstPanel!34otwwt", config: { baz: true }, defaultConfig: { baz: false } },
          ],
        });
      });
      expect(result.current.state!.configById).toEqual({
        "SecondPanel!2wydzut": { foo: "bar" },
        "FirstPanel!34otwwt": { baz: true },
      });
      act(() => {
        result.current.actions.changePanelLayout({
          layout: { direction: "row", first: "FirstPanel!34otwwt", second: "SecondPanel!2wydzut" },
        });
      });
      expect(result.current.state!.configById).toEqual({
        "SecondPanel!2wydzut": { foo: "bar" },
        "FirstPanel!34otwwt": { baz: true },
      });
      act(() => {
        result.current.actions.changePanelLayout({
          layout: { direction: "row", first: "FirstPanel!34otwwt", second: "ThirdPanel!ye6m1m" },
        });
      });
      expect(result.current.state!.configById).toEqual({
        "FirstPanel!34otwwt": { baz: true },
      });
      act(() => {
        result.current.actions.changePanelLayout({ layout: "foo!1234" });
      });
      expect(result.current.state!.configById).toEqual({});
      act(() => {
        result.current.actions.savePanelConfigs({
          configs: [{ id: "foo!1234", config: { okay: true }, defaultConfig: { okay: false } }],
        });
      });
      expect(result.current.state!.configById).toEqual({
        "foo!1234": { okay: true },
      });
    });

    it("removes a panel's configById when it is removed from Tab panel", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.changePanelLayout({ layout: tabPanelState.layout });
      });
      // eslint-disable-next-line no-restricted-syntax
      const leaves = getLeaves(tabPanelState.layout ?? null);
      expect(leaves).toHaveLength(4);
      expect(leaves).toContain("FirstPanel!34otwwt");
      expect(leaves).toContain("SecondPanel!2wydzut");
      expect(leaves).toContain("ThirdPanel!ye6m1m");
      expect(leaves).toContain("Tab!abc");
      expect(result.current.state!.configById).toEqual({});

      const baseTabConfig = {
        id: "Tab!abc",
        config: { tabs: [{ title: "Tab A", layout: "NestedPanel!xyz" }], activeTabIdx: 0 },
      };
      const nestedPanelConfig = { id: "NestedPanel!xyz", config: { foo: "bar" } };
      act(() => {
        result.current.actions.savePanelConfigs({ configs: [baseTabConfig] });
      });
      expect(result.current.state!.configById).toEqual({ "Tab!abc": baseTabConfig.config });

      act(() => {
        result.current.actions.savePanelConfigs({ configs: [nestedPanelConfig] });
      });
      expect(result.current.state!.configById).toEqual({
        "Tab!abc": baseTabConfig.config,
        "NestedPanel!xyz": nestedPanelConfig.config,
      });

      const emptyTabConfig = {
        id: "Tab!abc",
        config: { tabs: [{ title: "Tab A", layout: undefined }], activeTabIdx: 0 },
      };
      act(() => {
        result.current.actions.savePanelConfigs({ configs: [emptyTabConfig] });
      });
      // "NestedPanel!xyz" key in configById should be gone
      expect(result.current.state!.configById).toEqual({ "Tab!abc": emptyTabConfig.config });
    });

    it("does not remove old configById when trimConfigById = false", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.changePanelLayout({ layout: "foo!bar" });
        result.current.actions.savePanelConfigs({
          configs: [{ id: "foo!bar", config: { foo: "baz" } }],
        });
        result.current.actions.changePanelLayout({ layout: tabPanelState.layout });
      });
      expect(result.current.state!.configById).toEqual({});

      act(() => {
        result.current.actions.changePanelLayout({ layout: "foo!bar" });
        result.current.actions.savePanelConfigs({
          configs: [{ id: "foo!bar", config: { foo: "baz" } }],
        });
        result.current.actions.changePanelLayout({
          layout: tabPanelState.layout,
          trimConfigById: false,
        });
      });
      expect(result.current.state!.configById).toEqual({ "foo!bar": { foo: "baz" } });
    });
  });

  describe("handles dragging panels", () => {
    it("does not remove panel from single-panel layout when starting drag", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: { layout: "Audio!a", configById: {} },
        });
        result.current.actions.startDrag({ sourceTabId: undefined, path: [] });
      });
      expect(result.current.state!.layout).toEqual("Audio!a");
    });
    it("hides panel from multi-panel layout when starting drag", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: { first: "Audio!a", second: "RawMessages!a", direction: "column" },
            configById: {},
          },
        });
        result.current.actions.startDrag({ sourceTabId: undefined, path: ["second"] });
      });
      expect(result.current.state!.layout).toEqual({
        first: "Audio!a",
        second: "RawMessages!a",
        direction: "column",
        splitPercentage: 100,
      });
    });
    it("removes non-Tab panel from single-panel tab layout when starting drag", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: { first: "Tab!a", second: "RawMessages!a", direction: "column" },
            configById: {
              "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] },
            },
          },
        });
        result.current.actions.startDrag({ sourceTabId: "Tab!a", path: [] });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual({ first: "Tab!a", second: "RawMessages!a", direction: "column" });
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "A", layout: undefined }],
      });
    });
    it("hides panel from multi-panel Tab layout when starting drag", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: { first: "Tab!a", second: "RawMessages!a", direction: "column" },
            configById: {
              "Tab!a": {
                activeTabIdx: 0,
                tabs: [
                  { title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } },
                ],
              },
            },
          },
        });
        result.current.actions.startDrag({ sourceTabId: "Tab!a", path: ["first"] });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual({ first: "Tab!a", second: "RawMessages!a", direction: "column" });
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [
          {
            title: "A",
            layout: {
              first: "Audio!a",
              second: "Plot!a",
              direction: "row",
              splitPercentage: 0,
            },
          },
        ],
      });
    });
    it("handles drags within the same tab", () => {
      const { result } = renderProvider();
      const originalSavedProps = {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [{ title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } }],
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: { layout: "Tab!a", configById: originalSavedProps },
        });
        result.current.actions.startDrag({ sourceTabId: "Tab!a", path: ["first"] });
        result.current.actions.endDrag({
          originalLayout: "Tab!a",
          originalSavedProps,
          panelId: "Audio!a",
          sourceTabId: "Tab!a",
          targetTabId: "Tab!a",
          position: "right",
          destinationPath: ["second"],
          ownPath: ["first"],
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual("Tab!a");
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "A", layout: { first: "Plot!a", second: "Audio!a", direction: "row" } }],
      });
    });
    it("handles drags to main layout from Tab panel", () => {
      const { result } = renderProvider();
      const originalLayout = {
        first: "Tab!a",
        second: "RawMessages!a",
        direction: "column",
      } as MosaicParent<string>;
      const originalSavedProps = {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [{ title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } }],
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: originalLayout,
            configById: originalSavedProps,
          },
        });
        result.current.actions.startDrag({ sourceTabId: "Tab!a", path: ["first"] });
        result.current.actions.endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "Audio!a",
          sourceTabId: "Tab!a",
          targetTabId: undefined,
          position: "right",
          destinationPath: ["second"],
          ownPath: ["first"],
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual({
        first: "Tab!a",
        second: { first: "RawMessages!a", second: "Audio!a", direction: "row" },
        direction: "column",
      });
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "A", layout: "Plot!a" }],
      });
    });
    it("handles drags to Tab panel from main layout", () => {
      const { result } = renderProvider();
      const originalLayout = {
        first: "Tab!a",
        second: "RawMessages!a",
        direction: "column",
      } as MosaicParent<string>;
      const originalSavedProps = {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [{ title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } }],
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: originalLayout,
            configById: originalSavedProps,
          },
        });
        result.current.actions.startDrag({ sourceTabId: undefined, path: ["second"] });
        result.current.actions.endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "RawMessages!a",
          sourceTabId: undefined,
          targetTabId: "Tab!a",
          position: "right",
          destinationPath: ["second"],
          ownPath: ["second"],
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual("Tab!a");
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [
          {
            title: "A",
            layout: {
              first: "Audio!a",
              second: { first: "Plot!a", second: "RawMessages!a", direction: "row" },
              direction: "row",
            },
          },
        ],
      });
    });
    it("handles dragging non-Tab panels between Tab panels", () => {
      const { result } = renderProvider();
      const originalLayout = {
        first: "Tab!a",
        second: "Tab!b",
        direction: "column",
      } as MosaicParent<string>;
      const originalSavedProps = {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [{ title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } }],
        },
        "Tab!b": {
          activeTabIdx: 0,
          tabs: [
            {
              title: "B",
              layout: { first: "RawMessages!a", second: "Publish!a", direction: "row" },
            },
          ],
        },
      };
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: originalLayout,
            configById: originalSavedProps,
          },
        });
        result.current.actions.startDrag({ sourceTabId: "Tab!a", path: ["first"] });
        result.current.actions.endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "Audio!a",
          sourceTabId: "Tab!a",
          targetTabId: "Tab!b",
          position: "right",
          destinationPath: ["first"],
          ownPath: ["first"],
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual({ first: "Tab!a", second: "Tab!b", direction: "column" });
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "A", layout: "Plot!a" }],
      });
      expect(configById["Tab!b"]).toEqual({
        activeTabIdx: 0,
        tabs: [
          {
            title: "B",
            layout: {
              first: { first: "RawMessages!a", second: "Audio!a", direction: "row" },
              second: "Publish!a",
              direction: "row",
            },
          },
        ],
      });
    });
    it("handles dragging Tab panels between Tab panels", () => {
      const { result } = renderProvider();
      const originalLayout = {
        first: "Tab!a",
        second: "Tab!b",
        direction: "column",
      } as MosaicParent<string>;
      const tabCConfig = {
        activeTabIdx: 0,
        tabs: [
          { title: "C1", layout: "Plot!a" },
          { title: "C2", layout: undefined },
        ],
      };
      const originalSavedProps = {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [{ title: "A", layout: { first: "Tab!c", second: "Audio!a", direction: "row" } }],
        },
        "Tab!b": { activeTabIdx: 0, tabs: [{ title: "B" }] },
        "Tab!c": tabCConfig,
      };
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: {
            layout: originalLayout,
            configById: originalSavedProps,
          },
        });
        result.current.actions.startDrag({ sourceTabId: "Tab!a", path: ["first"] });
        result.current.actions.endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "Tab!c",
          sourceTabId: "Tab!a",
          targetTabId: "Tab!b",
          position: "right",
          destinationPath: [],
          ownPath: ["first"],
        });
      });
      const { layout, configById } = result.current.state!;
      expect(layout).toEqual({ first: "Tab!a", second: "Tab!b", direction: "column" });
      expect(configById["Tab!a"]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "A", layout: "Audio!a" }],
      });
      expect(configById["Tab!b"]).toEqual({
        activeTabIdx: 0,
        tabs: [{ title: "B", layout: "Tab!c" }],
      });
      expect(configById["Tab!c"]).toEqual(tabCConfig);
    });
    it("handles drags in single-panel layouts", () => {
      const { result } = renderProvider();
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: { layout: "Audio!a" },
        });
        result.current.actions.startDrag({ sourceTabId: undefined, path: [] });
        result.current.actions.endDrag({
          originalLayout: "Audio!a",
          originalSavedProps: {},
          panelId: "Audio!a",
          sourceTabId: undefined,
          targetTabId: undefined,
          position: "right",
          destinationPath: [],
          ownPath: [],
        });
      });
      expect(result.current.state!.layout).toEqual("Audio!a");
    });
    it("handles drags in multi-panel layouts", () => {
      const { result } = renderProvider();
      const originalLayout = {
        first: "Audio!a",
        second: "Plot!a",
        direction: "row",
      } as MosaicParent<string>;
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: { layout: originalLayout },
        });
        result.current.actions.startDrag({ sourceTabId: undefined, path: ["first"] });
        result.current.actions.endDrag({
          originalLayout,
          originalSavedProps: {},
          panelId: "Audio!a",
          sourceTabId: undefined,
          targetTabId: undefined,
          position: "right",
          destinationPath: ["second"],
          ownPath: ["first"],
        });
      });
      expect(result.current.state!.layout).toEqual({
        first: "Plot!a",
        second: "Audio!a",
        direction: "row",
      });
    });
    it("handles drags in multi-panel layouts - invalid position", () => {
      const { result } = renderProvider();
      const originalLayout = {
        first: "Audio!a",
        second: "Plot!a",
        direction: "row",
      } as MosaicParent<string>;
      act(() => {
        result.current.actions.setSelectedLayout({
          id: "X" as LayoutID,
          data: { layout: originalLayout },
        });
        result.current.actions.startDrag({ sourceTabId: undefined, path: ["first"] });
        result.current.actions.endDrag({
          originalLayout,
          originalSavedProps: {},
          panelId: "Audio!a",
          sourceTabId: undefined,
          targetTabId: undefined,
          position: undefined as unknown as MosaicDropTargetPosition,
          destinationPath: ["second"],
          ownPath: ["first"],
        });
      });
      expect(result.current.state!.layout).toEqual({
        first: "Audio!a",
        second: "Plot!a",
        direction: "row",
        splitPercentage: undefined,
      });
    });
  });
});
