// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { round } from "lodash";
import { MosaicNode } from "react-mosaic-component";

import { filterMap } from "@foxglove/den/collection";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import type { RendererConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_CAMERA_STATE } from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import {
  getAllPanelIds,
  getPanelIdForType,
  getPanelTypeFromId,
  isTabPanel,
  isTabPanelConfig,
} from "@foxglove/studio-base/util/layout";

const DEFAULT_PUBLISH_SETTINGS: RendererConfig["publish"] = {
  type: "point",
  poseTopic: "/move_base_simple/goal",
  pointTopic: "/clicked_point",
  poseEstimateTopic: "/initialpose",
  poseEstimateXDeviation: 0.5,
  poseEstimateYDeviation: 0.5,
  poseEstimateThetaDeviation: round(Math.PI / 12, 8),
};
type LegacyCameraState = {
  distance: number;
  perspective: boolean;
  phi: number;
  target: readonly [number, number, number];
  targetOffset: readonly [number, number, number];
  targetOrientation: readonly [number, number, number, number];
  thetaOffset: number;
  fovy: number;
  near: number;
  far: number;
};
type Legacy3DConfig = {
  cameraState: Partial<LegacyCameraState>;
  checkedKeys: string[];
  clickToPublishPoseTopic: string;
  clickToPublishPointTopic: string;
  clickToPublishPoseEstimateTopic: string;
  clickToPublishPoseEstimateXDeviation: number;
  clickToPublishPoseEstimateYDeviation: number;
  clickToPublishPoseEstimateThetaDeviation: number;
  followMode?: "follow" | "follow-orientation" | "no-follow";
  followTf?: string;
};

function migrateLegacyToNew3DConfig(legacyConfig: Partial<Legacy3DConfig>): RendererConfig {
  return {
    followTf: legacyConfig.followTf,
    followMode:
      legacyConfig.followMode === "follow-orientation"
        ? "follow-pose"
        : legacyConfig.followMode === "follow"
        ? "follow-position"
        : "follow-none",
    cameraState: {
      ...DEFAULT_CAMERA_STATE,
      ...legacyConfig.cameraState,
      phi: ((legacyConfig.cameraState?.phi ?? Math.PI / 3) * 180) / Math.PI,
      thetaOffset: ((legacyConfig.cameraState?.thetaOffset ?? 0) * 180) / Math.PI,
      fovy: ((legacyConfig.cameraState?.fovy ?? Math.PI / 4) * 180) / Math.PI,
    },
    publish: {
      type: "point",
      poseTopic: legacyConfig.clickToPublishPoseTopic ?? DEFAULT_PUBLISH_SETTINGS.poseTopic,
      pointTopic: legacyConfig.clickToPublishPointTopic ?? DEFAULT_PUBLISH_SETTINGS.pointTopic,
      poseEstimateTopic:
        legacyConfig.clickToPublishPoseEstimateTopic ?? DEFAULT_PUBLISH_SETTINGS.poseEstimateTopic,
      poseEstimateXDeviation:
        legacyConfig.clickToPublishPoseEstimateXDeviation ??
        DEFAULT_PUBLISH_SETTINGS.poseEstimateXDeviation,
      poseEstimateYDeviation:
        legacyConfig.clickToPublishPoseEstimateYDeviation ??
        DEFAULT_PUBLISH_SETTINGS.poseEstimateYDeviation,
      poseEstimateThetaDeviation:
        legacyConfig.clickToPublishPoseEstimateThetaDeviation ??
        DEFAULT_PUBLISH_SETTINGS.poseEstimateThetaDeviation,
    },
    topics: Object.fromEntries(
      filterMap(legacyConfig.checkedKeys ?? [], (key) =>
        key.startsWith("t:") ? [key.substring("t:".length), { visible: true }] : undefined,
      ),
    ),
    scene: {},
    transforms: {},
    layers: {},
    imageMode: {},
  };
}

function replacePanelInLayout(
  layout: MosaicNode<string>,
  oldId: string,
  newId: string,
): MosaicNode<string> {
  if (typeof layout === "string") {
    return layout === oldId ? newId : layout;
  } else {
    return {
      ...layout,
      first: replacePanelInLayout(layout.first, oldId, newId),
      second: replacePanelInLayout(layout.second, oldId, newId),
    };
  }
}

function replacePanel(
  panelsState: LayoutData,
  oldId: string,
  newId: string,
  newConfig: Record<string, unknown>,
): LayoutData {
  const newPanelsState = {
    ...panelsState,
    configById: { ...panelsState.configById, [newId]: newConfig },
  };
  delete newPanelsState.configById[oldId];
  if (newPanelsState.layout != undefined) {
    newPanelsState.layout = replacePanelInLayout(newPanelsState.layout, oldId, newId);
    const tabPanelIds = Object.keys(newPanelsState.configById).filter(isTabPanel);
    for (const tabId of tabPanelIds) {
      const tabConfig = newPanelsState.configById[tabId];
      if (isTabPanelConfig(tabConfig)) {
        newPanelsState.configById[tabId] = {
          ...tabConfig,
          tabs: tabConfig.tabs.map((tab) => ({
            ...tab,
            layout:
              tab.layout != undefined ? replacePanelInLayout(tab.layout, oldId, newId) : undefined,
          })),
        };
      }
    }
  }
  return newPanelsState;
}

export function migrateLegacyToNew3DPanels(layoutData: LayoutData): LayoutData {
  if (layoutData.layout == undefined) {
    return layoutData;
  }

  const legacy3DPanels = getAllPanelIds(layoutData.layout, layoutData.configById).filter(
    (id) => getPanelTypeFromId(id) === "3D Panel",
  );
  let newState = layoutData;
  for (const id of legacy3DPanels) {
    const legacyConfig = layoutData.configById[id] as Legacy3DConfig | undefined;
    if (legacyConfig != undefined) {
      newState = replacePanel(
        newState,
        id,
        getPanelIdForType("3D"),
        migrateLegacyToNew3DConfig(legacyConfig),
      );
    }
  }
  return newState;
}
