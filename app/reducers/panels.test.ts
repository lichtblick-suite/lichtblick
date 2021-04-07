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

import { getLeaves, MosaicParent } from "react-mosaic-component";

import {
  changePanelLayout,
  savePanelConfigs,
  importPanelLayout,
  createTabPanel,
  setUserNodes,
  closePanel,
  splitPanel,
  swapPanel,
  addPanel,
  dropPanel,
  moveTab,
  startDrag,
  endDrag,
} from "@foxglove-studio/app/actions/panels";
import { State, PersistedState } from "@foxglove-studio/app/reducers";
import {
  PanelsState,
  GLOBAL_STATE_STORAGE_KEY,
  resetInitialPersistedState,
  defaultPlaybackConfig,
  defaultPersistedState,
} from "@foxglove-studio/app/reducers/panels";
import { getGlobalStoreForTest } from "@foxglove-studio/app/store/getGlobalStore";
import {
  CreateTabPanelPayload,
  ImportPanelLayoutPayload,
  MosaicDropTargetPosition,
} from "@foxglove-studio/app/types/panels";
import Storage from "@foxglove-studio/app/util/Storage";
import { TAB_PANEL_TYPE } from "@foxglove-studio/app/util/globalConstants";
import { getPanelTypeFromId } from "@foxglove-studio/app/util/layout";

const storage = new Storage();

function GetGlobalState() {
  return storage.getItem(GLOBAL_STATE_STORAGE_KEY) as PersistedState;
}

const getStore = () => {
  const store = getGlobalStoreForTest();
  const checkState = (fn: (arg: Pick<State, "persistedState">) => void) => {
    const { persistedState } = store.getState();
    fn({ persistedState });
  };
  return { store, checkState };
};

describe("state.persistedState", () => {
  beforeEach(() => {
    resetInitialPersistedState();
    storage.clear();
  });

  it("stores initial panel layout in local storage", () => {
    const { checkState } = getStore();
    checkState(({ persistedState }) => {
      const globalState = GetGlobalState();
      expect(globalState).toEqual(persistedState);
    });
  });

  it("stores default settings in local storage", () => {
    const { checkState } = getStore();
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual(defaultPersistedState.panels.layout);
      expect(panels.savedProps).toEqual({});
      expect(storage.getItem(GLOBAL_STATE_STORAGE_KEY)).toEqual(defaultPersistedState);
    });
  });

  it("stores state changes in local storage", () => {
    const { store, checkState } = getStore();
    const payload = {
      layout: "foo!bar",
      savedProps: { "foo!bar": { test: true } },
    };

    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).not.toEqual("foo!bar");
      expect(panels.savedProps).toEqual({});
    });

    store.dispatch(importPanelLayout(payload));
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual("foo!bar");
      expect(panels.savedProps).toEqual({ "foo!bar": { test: true } });

      const globalState = GetGlobalState();
      expect(globalState.panels.layout).toEqual(panels.layout);
      expect(globalState.panels.savedProps).toEqual(panels.savedProps);
    });

    store.dispatch(changePanelLayout({ layout: "foo!bar" }));
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual("foo!bar");
      expect(panels.savedProps).toEqual({ "foo!bar": { test: true } });

      const globalState = GetGlobalState();
      expect(globalState.panels.layout).toEqual(panels.layout);
      expect(globalState.panels.savedProps).toEqual(panels.savedProps);
    });

    store.dispatch(
      savePanelConfigs({
        configs: [{ id: "foo!bar", config: { testing: true }, defaultConfig: { testing: false } }],
      }),
    );
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual("foo!bar");
      expect(panels.savedProps).toEqual({ "foo!bar": { test: true, testing: true } });

      const globalState = GetGlobalState();
      expect(globalState.panels.layout).toEqual(panels.layout);
      expect(globalState.panels.savedProps).toEqual(panels.savedProps);
    });
  });

  it("saves all keys of migrated payload to state, with appropriate fallbacks", () => {
    const { store, checkState } = getStore();

    const payload = {
      layout: "foo!bar",
      savedProps: { "foo!bar": { test: true } },
      futureFieldName: "foo",
    };

    store.dispatch(importPanelLayout(payload));
    checkState(({ persistedState: { panels } }) => {
      const result = {
        layout: "foo!bar",
        savedProps: { "foo!bar": { test: true } },
        globalVariables: {},
        userNodes: {},
        linkedGlobalVariables: [],
        playbackConfig: { speed: 0.2, messageOrder: "receiveTime", timeDisplayMethod: "ROS" },
        futureFieldName: "foo",
      };
      expect(panels).toEqual(result);

      const globalState = GetGlobalState();
      expect(globalState.panels).toEqual(result);
    });
  });

  it("sets default globalVariables, linkedGlobalVariables, userNodes in local storage if values are not in migrated payload", () => {
    const { store, checkState } = getStore();
    const payload = {
      layout: "foo!baz",
      savedProps: { foo: { test: true } },
    };

    store.dispatch(importPanelLayout(payload));
    checkState(() => {
      const globalState = GetGlobalState();
      expect(globalState.panels.globalVariables).toEqual({});
      expect(globalState.panels.userNodes).toEqual({});
      expect(globalState.panels.linkedGlobalVariables).toEqual([]);
    });
  });

  it("sets default speed in local storage if playbackConfig object is not in migrated payload", () => {
    const { store, checkState } = getStore();
    const payload = {
      layout: "foo!baz",
      savedProps: { foo: { test: true } },
    };

    store.dispatch(importPanelLayout(payload));
    checkState(() => {
      const globalState = GetGlobalState();
      expect(globalState.panels.playbackConfig).toEqual({
        messageOrder: "receiveTime",
        speed: 0.2,
        timeDisplayMethod: "ROS",
      });
    });
  });

  it("sets globalVariables, userNodes, linkedGlobalVariables in local storage", () => {
    const { store, checkState } = getStore();
    const globalVariables = { some_global_data_var: 1 };
    const linkedGlobalVariables = [
      { topic: "/foo", markerKeyPath: ["bar", "1"], name: "someVariableName" },
    ];
    const userNodes = { foo: { name: "foo", sourceCode: "foo node" } };
    const payload = {
      layout: "foo!baz",
      savedProps: { foo: { test: true } },
      globalVariables,
      userNodes,
      linkedGlobalVariables,
    };

    store.dispatch(importPanelLayout(payload));
    checkState(() => {
      const globalState = GetGlobalState();
      expect(globalState.panels.globalVariables).toEqual(globalVariables);
      expect(globalState.panels.userNodes).toEqual(userNodes);
      expect(globalState.panels.linkedGlobalVariables).toEqual(linkedGlobalVariables);
    });
  });

  describe("adds panel to a layout", () => {
    it("adds panel to main app layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = {
        layout: "Tab!a",
        savedProps: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        addPanel({
          type: "Audio",
          tabId: undefined,
          layout: panelLayout.layout,
          config: { foo: "bar" },
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        const layout = panels.layout as MosaicParent<string>;
        const firstStr = layout.first as string;
        const secondStr = layout.second as string;
        expect(layout.direction).toEqual("row");
        expect(getPanelTypeFromId(firstStr)).toEqual("Audio");
        expect(layout.second).toEqual("Tab!a");

        expect(panels.savedProps[firstStr]).toEqual({ foo: "bar" });
        expect(panels.savedProps[secondStr]).toEqual(panelLayout.savedProps["Tab!a"]);
      });
    });
    it("adds panel to empty Tab layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = {
        layout: "Tab!a",
        savedProps: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        addPanel({ type: "Audio", tabId: "Tab!a", layout: undefined, config: { foo: "bar" } }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          const tabs = savedProps["Tab!a"]?.tabs;
          const newAudioId = tabs[0].layout;
          expect(layout).toEqual("Tab!a");
          expect(savedProps["Tab!a"]?.activeTabIdx).toEqual(0);
          expect(tabs[0].title).toEqual("A");
          expect(getPanelTypeFromId(newAudioId)).toEqual("Audio");
          expect(tabs.length).toEqual(3);

          expect(savedProps[newAudioId]).toEqual({ foo: "bar" });
          expect(savedProps[layout as string]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "A", layout: newAudioId }, { title: "B" }, { title: "C" }],
          });
        },
      );
    });
  });

  describe("drops panel into a layout", () => {
    it("drops panel into app layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = {
        layout: "Tab!a",
        savedProps: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        dropPanel({
          newPanelType: "Audio",
          destinationPath: [],
          position: "right",
          config: { foo: "bar" },
          relatedConfigs: undefined,
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(layout.direction).toEqual("row");
          expect(layout.first).toEqual("Tab!a");
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
        },
      );
    });
    it("drops Tab panel into app layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = { layout: "Audio!a", savedProps: { "Audio!a": { foo: "bar" } } };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        dropPanel({
          newPanelType: "Tab",
          destinationPath: [],
          position: "right",
          config: { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!b" }] },
          relatedConfigs: { "Audio!b": { foo: "baz" } },
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(layout.direction).toEqual("row");
          expect(layout.first).toEqual("Audio!a");
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Tab");

          expect(savedProps["Audio!a"]).toEqual({ foo: "bar" });
          const { activeTabIdx, tabs } = savedProps[layout.second as string]!;
          expect(activeTabIdx).toEqual(0);
          expect(tabs.length).toEqual(1);
          expect(tabs[0].title).toEqual("A");

          const newAudioId = tabs[0].layout;
          expect(getPanelTypeFromId(newAudioId)).toEqual("Audio");
          expect(savedProps[newAudioId]).toEqual({ foo: "baz" });
        },
      );
    });
    it("drops panel into empty Tab layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = {
        layout: "Tab!a",
        savedProps: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        dropPanel({
          newPanelType: "Audio",
          destinationPath: [],
          position: "right",
          tabId: "Tab!a",
          config: { foo: "bar" },
          relatedConfigs: undefined,
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual("Tab!a");
          const tabs = savedProps["Tab!a"]?.tabs;
          expect(tabs[0].title).toEqual("A");
          expect(getPanelTypeFromId(tabs[0].layout)).toEqual("Audio");
          expect(tabs.length).toEqual(3);
        },
      );
    });
    it("drops panel into nested Tab layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = {
        layout: "Tab!a",
        savedProps: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: "Tab!b" }] },
          "Tab!b": { activeTabIdx: 0, tabs: [{ title: "B", layout: "Plot!a" }] },
        },
      };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        dropPanel({
          newPanelType: "Audio",
          destinationPath: [],
          position: "right",
          tabId: "Tab!b",
          config: { foo: "bar" },
          relatedConfigs: undefined,
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual("Tab!a");
          expect(savedProps["Tab!a"]).toEqual(panelLayout.savedProps["Tab!a"]);
          const tabBTabs = savedProps["Tab!b"]?.tabs;
          expect(tabBTabs.length).toEqual(1);
          expect(tabBTabs[0].layout.first).toEqual("Plot!a");
          expect(getPanelTypeFromId(tabBTabs[0].layout.second)).toEqual("Audio");
          expect(savedProps[tabBTabs[0].layout.second]).toEqual({ foo: "bar" });
        },
      );
    });
    it("drops nested Tab panel into main layout", () => {
      const { store, checkState } = getStore();
      const panelLayout = { layout: "Audio!a" };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        dropPanel({
          newPanelType: "Tab",
          destinationPath: [],
          position: "right",
          config: { activeTabIdx: 0, tabs: [{ title: "A", layout: "Tab!b" }] },
          relatedConfigs: {
            "Tab!b": { activeTabIdx: 0, tabs: [{ title: "B", layout: "Plot!a" }] },
          },
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(layout.first).toEqual("Audio!a");
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Tab");

          const parentTabConfig = savedProps[layout.second as string];
          expect(parentTabConfig?.tabs.length).toEqual(1);
          expect(parentTabConfig?.tabs[0].title).toEqual("A");

          const childTabId = parentTabConfig?.tabs[0].layout;
          expect(getPanelTypeFromId(childTabId)).toEqual("Tab");
          const childTabProps = savedProps[childTabId];
          expect(childTabProps?.activeTabIdx).toEqual(0);
          expect(childTabProps?.tabs.length).toEqual(1);
          expect(childTabProps?.tabs[0].title).toEqual("B");
          expect(getPanelTypeFromId(childTabProps?.tabs[0].layout)).toEqual("Plot");
        },
      );
    });
  });

  describe("moves tabs", () => {
    it("reorders tabs within a Tab panel", () => {
      const { store, checkState } = getStore();
      const panelLayout = {
        layout: "Tab!a",
        savedProps: {
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A" }, { title: "B" }, { title: "C" }] },
        },
      };
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        moveTab({
          source: { panelId: "Tab!a", tabIndex: 0 },
          target: { panelId: "Tab!a", tabIndex: 1 },
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "Tab!a": { activeTabIdx: 1, tabs: [{ title: "B" }, { title: "A" }, { title: "C" }] },
        });
      });
    });

    it("moves tabs between Tab panels", () => {
      const { store, checkState } = getStore();
      const layout: MosaicParent<string> = { first: "Tab!a", second: "Tab!b", direction: "row" };
      const panelLayout = {
        layout,
        savedProps: {
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
      store.dispatch(importPanelLayout(panelLayout));
      store.dispatch(
        moveTab({
          source: { panelId: "Tab!a", tabIndex: 0 },
          target: { panelId: "Tab!b", tabIndex: 1 },
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "Tab!a": { activeTabIdx: 0, tabs: [{ title: "B" }, { title: "C" }] },
          "Tab!b": {
            activeTabIdx: 0,
            tabs: [{ title: "D" }, { title: "A" }, { title: "E" }, { title: "F" }],
          },
        });
      });
    });
  });

  it("closes a panel in single-panel layout", () => {
    const { store, checkState } = getStore();
    store.dispatch(
      importPanelLayout({ layout: "Audio!a", savedProps: { "Audio!a": { foo: "bar" } } }),
    );
    store.dispatch(closePanel({ root: "Audio!a", path: [] }));
    checkState(
      ({
        persistedState: {
          panels: { layout, savedProps },
        },
      }) => {
        expect(layout).toEqual(undefined);
        expect(savedProps).toEqual({});
      },
    );
  });

  it("closes a panel in multi-panel layout", () => {
    const { store, checkState } = getStore();
    const layout: MosaicParent<string> = { first: "Audio!a", second: "Audio!b", direction: "row" };
    const panelLayout = {
      layout,
      savedProps: { "Audio!a": { foo: "bar" }, "Audio!b": { foo: "baz" } },
    };
    store.dispatch(importPanelLayout(panelLayout));
    store.dispatch(closePanel({ root: panelLayout.layout, path: ["first"] }));
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual("Audio!b");
      expect(panels.savedProps).toEqual({ "Audio!b": { foo: "baz" } });
    });
  });

  it("closes a panel nested inside a Tab panel", () => {
    const { store, checkState } = getStore();
    const panelLayout = {
      layout: "Tab!a",
      savedProps: {
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] },
        "Audio!a": { foo: "bar" },
      },
    };
    store.dispatch(importPanelLayout(panelLayout));
    store.dispatch(closePanel({ root: "Audio!a", path: [], tabId: "Tab!a" }));
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual("Tab!a");
      expect(panels.savedProps).toEqual({
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: undefined }] },
      });
    });
  });

  it("loads a layout", () => {
    const { store, checkState } = getStore();
    const panelsState = (<unknown>{ layout: { foo: "baz" } }) as PanelsState;
    store.dispatch({ type: "LOAD_LAYOUT", payload: panelsState });
    checkState(({ persistedState: { panels } }) => {
      expect(panels.layout).toEqual({ foo: "baz" });
    });
  });

  it("resets panels to a valid state when importing an empty layout", () => {
    const { store, checkState } = getStore();
    store.dispatch(importPanelLayout({ layout: undefined }));
    checkState(({ persistedState: { panels } }) => {
      expect(panels).toEqual({
        globalVariables: {},
        layout: undefined,
        linkedGlobalVariables: [],
        playbackConfig: defaultPlaybackConfig,
        savedProps: {},
        userNodes: {},
      });
    });
  });

  it("will set local storage when importing a panel layout, if reducer is not told to skipSettingLocalStorage", () => {
    const { store, checkState } = getStore();

    const x = importPanelLayout({ layout: "myNewLayout", savedProps: {} }, {});
    store.dispatch(x);
    checkState(() => {
      const globalState = GetGlobalState();
      expect(globalState.panels.layout).toEqual("myNewLayout");
    });
  });

  it("will not set local storage when importing a panel layout, if reducer is told to skipSettingLocalStorage", () => {
    const { store, checkState } = getStore();

    store.dispatch(
      importPanelLayout({ layout: undefined, savedProps: {} }, { skipSettingLocalStorage: true }),
    );
    checkState(({ persistedState: { panels } }) => {
      const globalState = GetGlobalState();
      expect(globalState.panels.layout).not.toEqual(panels.layout);
    });
  });

  describe("creates Tab panels from existing panels correctly", () => {
    const { store, checkState } = getStore();
    const regularLayoutPayload = {
      layout: {
        first: "Audio!a",
        second: { first: "RawMessages!a", second: "Audio!c", direction: "column" },
        direction: "row",
      },
      savedProps: { "Audio!a": { foo: "bar" }, "RawMessages!a": { foo: "baz" } },
    } as ImportPanelLayoutPayload;
    const basePayload = {
      idToReplace: "Audio!a",
      newId: "Tab!a",
      idsToRemove: ["Audio!a", "RawMessages!a"],
      singleTab: false,
    };
    const nestedLayoutPayload = {
      layout: {
        first: "Audio!a",
        second: "Tab!z",
        direction: "column",
      },
      savedProps: {
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
    } as ImportPanelLayoutPayload;
    const createTabPanelPayload = {
      ...basePayload,
      layout: regularLayoutPayload.layout,
    } as CreateTabPanelPayload;
    const nestedCreateTabPanelPayload = {
      ...basePayload,
      layout: nestedLayoutPayload.layout,
    } as CreateTabPanelPayload;

    it("will group selected panels into a Tab panel", () => {
      store.dispatch(importPanelLayout(regularLayoutPayload, { skipSettingLocalStorage: true }));
      store.dispatch(createTabPanel({ ...createTabPanelPayload, singleTab: true }));

      checkState(
        ({
          persistedState: {
            panels: { savedProps, layout: maybeLayout },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
          expect(savedProps[layout.first as string]).toEqual({
            activeTabIdx: 0,
            tabs: [
              {
                title: "1",
                layout: { direction: "row", first: "Audio!a", second: "RawMessages!a" },
              },
            ],
          });
          expect(savedProps[layout.second as string]).toEqual(
            regularLayoutPayload.savedProps?.[layout.second as string],
          );
        },
      );
    });

    it("will group selected panels into a Tab panel, even when a selected panel is nested", () => {
      store.dispatch(importPanelLayout(nestedLayoutPayload, { skipSettingLocalStorage: true }));
      store.dispatch(createTabPanel({ ...nestedCreateTabPanelPayload, singleTab: true }));

      checkState(
        ({
          persistedState: {
            panels: { savedProps, layout: maybeLayout },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
          expect(getPanelTypeFromId(layout.second as string)).toEqual(TAB_PANEL_TYPE);
          expect(savedProps[layout.first as string]).toEqual({
            activeTabIdx: 0,
            tabs: [
              {
                title: "1",
                layout: { direction: "column", first: "Audio!a", second: "RawMessages!a" },
              },
            ],
          });
          expect(savedProps[layout.second as string]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "First tab", layout: "Audio!b" }],
          });
        },
      );
    });

    it("will create individual tabs for selected panels in a new Tab panel", () => {
      store.dispatch(importPanelLayout(regularLayoutPayload, { skipSettingLocalStorage: true }));
      store.dispatch(createTabPanel({ ...createTabPanelPayload, singleTab: false }));

      checkState(
        ({
          persistedState: {
            panels: { savedProps, layout: maybeLayout },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
          expect(savedProps[layout.first as string]).toEqual({
            activeTabIdx: 0,
            tabs: [
              { title: "Audio", layout: "Audio!a" },
              { title: "RawMessages", layout: "RawMessages!a" },
            ],
          });
          expect(savedProps[layout.second as string]).toEqual(
            regularLayoutPayload.savedProps?.[layout.second as string],
          );
        },
      );
    });

    it("will create individual tabs for selected panels in a new Tab panel, even when a selected panel is nested", () => {
      store.dispatch(importPanelLayout(nestedLayoutPayload, { skipSettingLocalStorage: true }));
      store.dispatch(createTabPanel({ ...nestedCreateTabPanelPayload, singleTab: false }));

      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(getPanelTypeFromId(layout.first as string)).toEqual(TAB_PANEL_TYPE);
          expect(getPanelTypeFromId(layout.second as string)).toEqual(TAB_PANEL_TYPE);
          expect(savedProps[layout.first as string]).toEqual({
            activeTabIdx: 0,
            tabs: [
              { title: "Audio", layout: "Audio!a" },
              { title: "RawMessages", layout: "RawMessages!a" },
            ],
          });
          expect(savedProps[layout.second as string]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "First tab", layout: "Audio!b" }],
          });
        },
      );
    });
  });

  it("saves and overwrites Webviz nodes", () => {
    const { store, checkState } = getStore();
    const firstPayload = { foo: { name: "foo", sourceCode: "bar" } };
    const secondPayload = { bar: { name: "bar", sourceCode: "baz" } };

    store.dispatch(setUserNodes(firstPayload));
    checkState(({ persistedState: { panels } }) => {
      expect(panels.userNodes).toEqual(firstPayload);
    });

    store.dispatch(setUserNodes(secondPayload));
    checkState(({ persistedState: { panels } }) => {
      expect(panels.userNodes).toEqual({ ...firstPayload, ...secondPayload });
    });
  });

  describe("panel toolbar actions", () => {
    it("can split panel", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "Audio!a" }));

      const audioConfig = { foo: "bar" };
      store.dispatch(savePanelConfigs({ configs: [{ id: "Audio!a", config: audioConfig }] }));

      store.dispatch(
        splitPanel({
          id: "Audio!a",
          config: audioConfig,
          direction: "row",
          path: [],
          root: "Audio!a",
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(layout.first).toEqual("Audio!a");
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Audio");
          expect(layout.direction).toEqual("row");
          expect(savedProps["Audio!a"]).toEqual(audioConfig);
          expect(savedProps[layout.second as string]).toEqual(audioConfig);
        },
      );
    });

    it("can split Tab panel", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "Tab!a" }));

      const audioConfig = { foo: "bar" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] };
      store.dispatch(
        savePanelConfigs({
          configs: [
            { id: "Tab!a", config: tabConfig },
            { id: "Audio!a", config: audioConfig },
          ],
        }),
      );

      store.dispatch(
        splitPanel({ id: "Tab!a", config: tabConfig, direction: "row", path: [], root: "Tab!a" }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as MosaicParent<string>;
          expect(layout.first).toEqual("Tab!a");
          expect(getPanelTypeFromId(layout.second as string)).toEqual("Tab");
          expect(layout.direction).toEqual("row");
          expect(savedProps["Tab!a"]).toEqual(tabConfig);
          expect(getPanelTypeFromId(savedProps[layout.second as string]?.tabs[0].layout)).toEqual(
            "Audio",
          );
          expect(savedProps["Audio!a"]).toEqual(audioConfig);
        },
      );
    });

    it("can split panel inside Tab panel", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "Tab!a" }));

      const audioConfig = { foo: "bar" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] };
      store.dispatch(
        savePanelConfigs({
          configs: [
            { id: "Tab!a", config: tabConfig },
            { id: "Audio!a", config: audioConfig },
          ],
        }),
      );

      store.dispatch(
        splitPanel({
          id: "Audio!a",
          tabId: "Tab!a",
          config: audioConfig,
          direction: "row",
          path: [],
          root: "Audio!a",
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual("Tab!a");
          const tabLayout = savedProps["Tab!a"]?.tabs[0].layout;
          expect(tabLayout.first).toEqual("Audio!a");
          expect(getPanelTypeFromId(tabLayout.second)).toEqual("Audio");
          expect(tabLayout.direction).toEqual("row");
          expect(savedProps["Audio!a"]).toEqual(audioConfig);
          expect(savedProps[tabLayout.second]).toEqual(audioConfig);
        },
      );
    });

    it("can swap panels", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "Audio!a" }));

      const audioConfig = { foo: "bar" };
      const rawMessagesConfig = { foo: "baz" };
      store.dispatch(savePanelConfigs({ configs: [{ id: "Audio!a", config: audioConfig }] }));

      store.dispatch(
        swapPanel({
          originalId: "Audio!a",
          type: "RawMessages",
          config: rawMessagesConfig,
          path: [],
          root: "Audio!a",
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as string;
          expect(getPanelTypeFromId(layout)).toEqual("RawMessages");
          expect(savedProps["Audio!a"]).toEqual(undefined);
          expect(savedProps[layout]).toEqual(rawMessagesConfig);
        },
      );
    });

    it("can swap panel for a Tab panel", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "Audio!a" }));

      const audioConfig = { foo: "bar" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "RawMessages!a" }] };
      const rawMessagesConfig = { path: "foo" };
      store.dispatch(savePanelConfigs({ configs: [{ id: "Audio!a", config: audioConfig }] }));

      store.dispatch(
        swapPanel({
          originalId: "Audio!a",
          type: "Tab",
          config: tabConfig,
          relatedConfigs: { "RawMessages!a": rawMessagesConfig },
          path: [],
          root: "Audio!a",
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout: maybeLayout, savedProps },
          },
        }) => {
          const layout = maybeLayout as string;
          expect(getPanelTypeFromId(layout)).toEqual("Tab");
          const tabLayout = savedProps[layout]?.tabs[0].layout;
          expect(getPanelTypeFromId(tabLayout)).toEqual("RawMessages");
          expect(savedProps[tabLayout]).toEqual(rawMessagesConfig);
        },
      );
    });

    it("can swap panel inside a Tab", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "Tab!a" }));

      const rawMessagesConfig = { foo: "baz" };
      const tabConfig = { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] };
      store.dispatch(
        savePanelConfigs({
          configs: [{ id: "Tab!a", config: tabConfig }],
        }),
      );

      store.dispatch(
        swapPanel({
          originalId: "Audio!a",
          tabId: "Tab!a",
          type: "RawMessages",
          config: rawMessagesConfig,
          path: [],
          root: "Audio!a",
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual("Tab!a");
          const tabLayout = savedProps["Tab!a"]?.tabs[0].layout;
          expect(getPanelTypeFromId(tabLayout)).toEqual("RawMessages");
          expect(savedProps[tabLayout]).toEqual(rawMessagesConfig);
        },
      );
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
      savedProps: {},
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
      savedProps: {},
    } as PanelsState;

    it("removes a panel's savedProps when it is removed from the layout", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: panelState.layout }));
      checkState(({ persistedState: { panels } }) => {
        // eslint-disable-next-line no-restricted-syntax
        const leaves = getLeaves(panelState.layout ?? null);
        expect(leaves).toHaveLength(4);
        expect(leaves).toContain("FirstPanel!34otwwt");
        expect(leaves).toContain("SecondPanel!2wydzut");
        expect(leaves).toContain("ThirdPanel!ye6m1m");
        expect(leaves).toContain("FourthPanel!abc");
        expect(panels.savedProps).toEqual({});
      });

      const panelConfig = {
        id: "SecondPanel!2wydzut",
        config: { foo: "bar" },
        defaultConfig: { foo: "" },
      };
      store.dispatch(
        savePanelConfigs({
          configs: [
            panelConfig,
            { id: "FirstPanel!34otwwt", config: { baz: true }, defaultConfig: { baz: false } },
          ],
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "SecondPanel!2wydzut": { foo: "bar" },
          "FirstPanel!34otwwt": { baz: true },
        });
      });
      store.dispatch(
        changePanelLayout({
          layout: { direction: "row", first: "FirstPanel!34otwwt", second: "SecondPanel!2wydzut" },
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "SecondPanel!2wydzut": { foo: "bar" },
          "FirstPanel!34otwwt": { baz: true },
        });
      });
      store.dispatch(
        changePanelLayout({
          layout: { direction: "row", first: "FirstPanel!34otwwt", second: "ThirdPanel!ye6m1m" },
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "FirstPanel!34otwwt": { baz: true },
        });
      });
      store.dispatch(changePanelLayout({ layout: "foo!1234" }));
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({});
      });
      store.dispatch(
        savePanelConfigs({
          configs: [{ id: "foo!1234", config: { okay: true }, defaultConfig: { okay: false } }],
        }),
      );
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "foo!1234": { okay: true },
        });
      });
    });

    it("removes a panel's savedProps when it is removed from Tab panel", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: tabPanelState.layout }));
      checkState(({ persistedState: { panels } }) => {
        // eslint-disable-next-line no-restricted-syntax
        const leaves = getLeaves(tabPanelState.layout ?? null);
        expect(leaves).toHaveLength(4);
        expect(leaves).toContain("FirstPanel!34otwwt");
        expect(leaves).toContain("SecondPanel!2wydzut");
        expect(leaves).toContain("ThirdPanel!ye6m1m");
        expect(leaves).toContain("Tab!abc");
        expect(panels.savedProps).toEqual({});
      });

      const baseTabConfig = {
        id: "Tab!abc",
        config: { tabs: [{ title: "Tab A", layout: "NestedPanel!xyz" }], activeTabIdx: 0 },
      };
      store.dispatch(savePanelConfigs({ configs: [baseTabConfig] }));
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({ "Tab!abc": baseTabConfig.config });
      });

      const nestedPanelConfig = { id: "NestedPanel!xyz", config: { foo: "bar" } };
      store.dispatch(savePanelConfigs({ configs: [nestedPanelConfig] }));
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({
          "Tab!abc": baseTabConfig.config,
          "NestedPanel!xyz": nestedPanelConfig.config,
        });
      });

      const emptyTabConfig = {
        id: "Tab!abc",
        config: { tabs: [{ title: "Tab A", layout: undefined }], activeTabIdx: 0 },
      };
      store.dispatch(savePanelConfigs({ configs: [emptyTabConfig] }));
      checkState(({ persistedState: { panels } }) => {
        // "NestedPanel!xyz" key in savedProps should be gone
        expect(panels.savedProps).toEqual({ "Tab!abc": emptyTabConfig.config });
      });
    });

    it("does not remove old savedProps when trimSavedProps = false", () => {
      const { store, checkState } = getStore();
      store.dispatch(changePanelLayout({ layout: "foo!bar" }));
      store.dispatch(savePanelConfigs({ configs: [{ id: "foo!bar", config: { foo: "baz" } }] }));
      store.dispatch(changePanelLayout({ layout: tabPanelState.layout }));
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({});
      });

      store.dispatch(changePanelLayout({ layout: "foo!bar" }));
      store.dispatch(savePanelConfigs({ configs: [{ id: "foo!bar", config: { foo: "baz" } }] }));
      store.dispatch(changePanelLayout({ layout: tabPanelState.layout, trimSavedProps: false }));
      checkState(({ persistedState: { panels } }) => {
        expect(panels.savedProps).toEqual({ "foo!bar": { foo: "baz" } });
      });
    });
  });

  describe("handles dragging panels", () => {
    it("does not remove panel from single-panel layout when starting drag", () => {
      const { store, checkState } = getStore();
      store.dispatch(importPanelLayout({ layout: "Audio!a", savedProps: {} }));
      store.dispatch(startDrag({ sourceTabId: undefined, path: [] }));
      checkState(
        ({
          persistedState: {
            panels: { layout },
          },
        }) => {
          expect(layout).toEqual("Audio!a");
        },
      );
    });
    it("hides panel from multi-panel layout when starting drag", () => {
      const { store, checkState } = getStore();
      store.dispatch(
        importPanelLayout({
          layout: { first: "Audio!a", second: "RawMessages!a", direction: "column" },
          savedProps: {},
        }),
      );
      store.dispatch(startDrag({ sourceTabId: undefined, path: ["second"] }));
      checkState(
        ({
          persistedState: {
            panels: { layout },
          },
        }) => {
          expect(layout).toEqual({
            first: "Audio!a",
            second: "RawMessages!a",
            direction: "column",
            splitPercentage: 100,
          });
        },
      );
    });
    it("removes non-Tab panel from single-panel tab layout when starting drag", () => {
      const { store, checkState } = getStore();
      store.dispatch(
        importPanelLayout({
          layout: { first: "Tab!a", second: "RawMessages!a", direction: "column" },
          savedProps: {
            "Tab!a": { activeTabIdx: 0, tabs: [{ title: "A", layout: "Audio!a" }] },
          },
        }),
      );
      store.dispatch(startDrag({ sourceTabId: "Tab!a", path: [] }));
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual({ first: "Tab!a", second: "RawMessages!a", direction: "column" });
          expect(savedProps["Tab!a"]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "A", layout: undefined }],
          });
        },
      );
    });
    it("hides panel from multi-panel Tab layout when starting drag", () => {
      const { store, checkState } = getStore();
      store.dispatch(
        importPanelLayout({
          layout: { first: "Tab!a", second: "RawMessages!a", direction: "column" },
          savedProps: {
            "Tab!a": {
              activeTabIdx: 0,
              tabs: [
                { title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } },
              ],
            },
          },
        }),
      );
      store.dispatch(startDrag({ sourceTabId: "Tab!a", path: ["first"] }));
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual({ first: "Tab!a", second: "RawMessages!a", direction: "column" });
          expect(savedProps["Tab!a"]).toEqual({
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
        },
      );
    });
    it("handles drags within the same tab", () => {
      const { store, checkState } = getStore();
      const originalSavedProps = {
        "Tab!a": {
          activeTabIdx: 0,
          tabs: [{ title: "A", layout: { first: "Audio!a", second: "Plot!a", direction: "row" } }],
        },
      };
      store.dispatch(importPanelLayout({ layout: "Tab!a", savedProps: originalSavedProps }));
      store.dispatch(startDrag({ sourceTabId: "Tab!a", path: ["first"] }));
      store.dispatch(
        endDrag({
          originalLayout: "Tab!a",
          originalSavedProps,
          panelId: "Audio!a",
          sourceTabId: "Tab!a",
          targetTabId: "Tab!a",
          position: "right",
          destinationPath: ["second"],
          ownPath: ["first"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual("Tab!a");
          expect(savedProps["Tab!a"]).toEqual({
            activeTabIdx: 0,
            tabs: [
              { title: "A", layout: { first: "Plot!a", second: "Audio!a", direction: "row" } },
            ],
          });
        },
      );
    });
    it("handles drags to main layout from Tab panel", () => {
      const { store, checkState } = getStore();
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
      store.dispatch(importPanelLayout({ layout: originalLayout, savedProps: originalSavedProps }));
      store.dispatch(startDrag({ sourceTabId: "Tab!a", path: ["first"] }));
      store.dispatch(
        endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "Audio!a",
          sourceTabId: "Tab!a",
          targetTabId: undefined,
          position: "right",
          destinationPath: ["second"],
          ownPath: ["first"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual({
            first: "Tab!a",
            second: { first: "RawMessages!a", second: "Audio!a", direction: "row" },
            direction: "column",
          });
          expect(savedProps["Tab!a"]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "A", layout: "Plot!a" }],
          });
        },
      );
    });
    it("handles drags to Tab panel from main layout", () => {
      const { store, checkState } = getStore();
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
      store.dispatch(
        importPanelLayout({
          layout: originalLayout,
          savedProps: originalSavedProps,
        }),
      );
      store.dispatch(startDrag({ sourceTabId: undefined, path: ["second"] }));
      store.dispatch(
        endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "RawMessages!a",
          sourceTabId: undefined,
          targetTabId: "Tab!a",
          position: "right",
          destinationPath: ["second"],
          ownPath: ["second"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual("Tab!a");
          expect(savedProps["Tab!a"]).toEqual({
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
        },
      );
    });
    it("handles dragging non-Tab panels between Tab panels", () => {
      const { store, checkState } = getStore();
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
      store.dispatch(importPanelLayout({ layout: originalLayout, savedProps: originalSavedProps }));
      store.dispatch(startDrag({ sourceTabId: "Tab!a", path: ["first"] }));
      store.dispatch(
        endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "Audio!a",
          sourceTabId: "Tab!a",
          targetTabId: "Tab!b",
          position: "right",
          destinationPath: ["first"],
          ownPath: ["first"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual({ first: "Tab!a", second: "Tab!b", direction: "column" });
          expect(savedProps["Tab!a"]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "A", layout: "Plot!a" }],
          });
          expect(savedProps["Tab!b"]).toEqual({
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
        },
      );
    });
    it("handles dragging Tab panels between Tab panels", () => {
      const { store, checkState } = getStore();
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
      store.dispatch(importPanelLayout({ layout: originalLayout, savedProps: originalSavedProps }));
      store.dispatch(startDrag({ sourceTabId: "Tab!a", path: ["first"] }));
      store.dispatch(
        endDrag({
          originalLayout,
          originalSavedProps,
          panelId: "Tab!c",
          sourceTabId: "Tab!a",
          targetTabId: "Tab!b",
          position: "right",
          destinationPath: [],
          ownPath: ["first"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout, savedProps },
          },
        }) => {
          expect(layout).toEqual({ first: "Tab!a", second: "Tab!b", direction: "column" });
          expect(savedProps["Tab!a"]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "A", layout: "Audio!a" }],
          });
          expect(savedProps["Tab!b"]).toEqual({
            activeTabIdx: 0,
            tabs: [{ title: "B", layout: "Tab!c" }],
          });
          expect(savedProps["Tab!c"]).toEqual(tabCConfig);
        },
      );
    });
    it("handles drags in single-panel layouts", () => {
      const { store, checkState } = getStore();
      store.dispatch(importPanelLayout({ layout: "Audio!a" }));
      store.dispatch(startDrag({ sourceTabId: undefined, path: [] }));
      store.dispatch(
        endDrag({
          originalLayout: "Audio!a",
          originalSavedProps: {},
          panelId: "Audio!a",
          sourceTabId: undefined,
          targetTabId: undefined,
          position: "right",
          destinationPath: [],
          ownPath: [],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout },
          },
        }) => {
          expect(layout).toEqual("Audio!a");
        },
      );
    });
    it("handles drags in multi-panel layouts", () => {
      const { store, checkState } = getStore();
      const originalLayout = {
        first: "Audio!a",
        second: "Plot!a",
        direction: "row",
      } as MosaicParent<string>;
      store.dispatch(importPanelLayout({ layout: originalLayout }));
      store.dispatch(startDrag({ sourceTabId: undefined, path: ["first"] }));
      store.dispatch(
        endDrag({
          originalLayout,
          originalSavedProps: {},
          panelId: "Audio!a",
          sourceTabId: undefined,
          targetTabId: undefined,
          position: "right",
          destinationPath: ["second"],
          ownPath: ["first"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout },
          },
        }) => {
          expect(layout).toEqual({ first: "Plot!a", second: "Audio!a", direction: "row" });
        },
      );
    });
    it("handles drags in multi-panel layouts - invalid position", () => {
      const { store, checkState } = getStore();
      const originalLayout = {
        first: "Audio!a",
        second: "Plot!a",
        direction: "row",
      } as MosaicParent<string>;
      store.dispatch(importPanelLayout({ layout: originalLayout }));
      store.dispatch(startDrag({ sourceTabId: undefined, path: ["first"] }));
      store.dispatch(
        endDrag({
          originalLayout,
          originalSavedProps: {},
          panelId: "Audio!a",
          sourceTabId: undefined,
          targetTabId: undefined,
          position: (<unknown>undefined) as MosaicDropTargetPosition,
          destinationPath: ["second"],
          ownPath: ["first"],
        }),
      );
      checkState(
        ({
          persistedState: {
            panels: { layout },
          },
        }) => {
          expect(layout).toEqual({
            first: "Audio!a",
            second: "Plot!a",
            direction: "row",
            splitPercentage: undefined,
          });
        },
      );
    });
  });
});
