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

import { perPanelHooks } from "@foxglove-studio/app/BuiltinPanelHooks";
import { PersistedState, Store } from "@foxglove-studio/app/reducers";
import {
  LAYOUT_URL_QUERY_KEY,
  REMOTE_BAG_URL_2_QUERY_KEY,
} from "@foxglove-studio/app/util/globalConstants";
import { initializeLogEvent } from "@foxglove-studio/app/util/logEvent";

let importedPanelsByCategory: any;
const importedPerPanelHooks = perPanelHooks();
const defaultHooks = {
  getLayoutFromUrl: async (search: string) => {
    const params = new URLSearchParams(search);
    const layoutUrl = params.get(LAYOUT_URL_QUERY_KEY);
    if (!layoutUrl) {
      throw new Error(`Missing query argument: ${LAYOUT_URL_QUERY_KEY}`);
    }
    return fetch(layoutUrl)
      .then((result) => {
        try {
          return result.json();
        } catch (e) {
          throw new Error(`Failed to parse JSON layout: ${e.message}`);
        }
      })
      .catch((e) => {
        throw new Error(`Failed to fetch layout from URL: ${e.message}`);
      });
  },
  async importHooksAsync() {},
  nodes: () => [],
  getDefaultPersistedState() {
    // All panel fields have to be present.
    const state: PersistedState = {
      fetchedLayout: { isLoading: false, data: undefined },
      search: "",
      panels: {
        layout: {
          direction: "row",
          first: "DiagnosticSummary!3edblo1",
          second: {
            direction: "row",
            first: "RosOut!1f38b3d",
            second: "3D Panel!1my2ydk",
            splitPercentage: 50,
          },
          splitPercentage: 33.3333333333,
        },
        savedProps: {},
        globalVariables: {},
        userNodes: {},
        linkedGlobalVariables: [],
        playbackConfig: {
          speed: 0.2,
          messageOrder: "receiveTime",
          timeDisplayMethod: "ROS",
        },
      },
    };
    return state;
  },
  panelCategories() {
    return [
      { label: "ROS", key: "ros" },
      { label: "Utilities", key: "utilities" },
      { label: "Debugging", key: "debugging" },
    ];
  },
  panelsByCategory: () => {
    if (!importedPanelsByCategory) {
      return {
        ros: [],
        utilities: [],
        debugging: [],
      };
    }
    return importedPanelsByCategory;
  },
  helpPageFootnote: () => null,
  perPanelHooks: () => {
    return importedPerPanelHooks;
  },
  startupPerPanelHooks: () => {
    return {
      ThreeDimensionalViz: {
        getDefaultTopicSettingsByColumn() {
          return undefined;
        },
        getDefaultSettings: () => ({}),
        getDefaultTopicTree: () => ({
          name: "root",
          children: [
            {
              name: "TF",
              topicName: "/tf",
              children: [],
              description: "Visualize relationships between /tf frames.",
            },
          ],
        }),
        getStaticallyAvailableNamespacesByTopic: () => ({}),
      },
    };
  },
  load: async () => {
    // Due to some top level uses of getGlobalConfig() inside panels sources
    // We need to set the panelCategories after we set perPanelHooks
    // So we move this import here and set perPanelHooks above via top level imports
    const { panelsByCategory } = await import("@foxglove-studio/app/BuiltinPanels");
    importedPanelsByCategory = panelsByCategory();

    initializeLogEvent(() => undefined, {}, {});
  },
  getAdditionalDataProviders: () => {
    // do nothing
  },
  linkMessagePathSyntaxToHelpPage: () => true,
  getSecondSourceUrlParams() {
    return [REMOTE_BAG_URL_2_QUERY_KEY];
  },
  updateUrlToTrackLayoutChanges: async (_opt: { store: Store; skipPatch: boolean }) => {
    // Persist the layout state in URL or remote storage if needed.
    await Promise.resolve();
  },
  getPoseErrorScaling() {
    const scaling = {
      x: 1,
      y: 1,
    };

    return { originalScaling: scaling, updatedScaling: scaling };
  },
};

let hooks = defaultHooks;

export function getGlobalConfig() {
  return hooks;
}

export function setGlobalConfig(hooksToSet: Record<string, unknown>) {
  hooks = { ...hooks, ...hooksToSet };
}

export function resetGlobalConfigToDefault() {
  hooks = defaultHooks;
}
