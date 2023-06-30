// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import type { RendererConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { DEFAULT_CAMERA_STATE } from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PublishSettings";
import {
  getAllPanelIds,
  getPanelIdForType,
  getPanelTypeFromId,
} from "@foxglove/studio-base/util/layout";

import { replacePanel } from "./replacePanel";

type LegacyImageConfig = {
  cameraTopic: string;
  enabledMarkerTopics: string[];
  synchronize: boolean;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  maxValue?: number;
  minValue?: number;
  mode?: "fit" | "fill" | "other";
  pan?: { x: number; y: number };
  rotation?: number;
  smooth?: boolean;
  transformMarkers: boolean;
  zoom?: number;
  zoomPercentage?: number;
};

function migrateLegacyToNewImageConfig(legacyConfig: Partial<LegacyImageConfig>): RendererConfig {
  return {
    cameraState: DEFAULT_CAMERA_STATE,
    followMode: "follow-pose",
    followTf: undefined,
    scene: {},
    transforms: {},
    topics: {},
    layers: {},
    publish: DEFAULT_PUBLISH_SETTINGS,
    imageMode: {
      imageTopic: legacyConfig.cameraTopic,
      calibrationTopic: undefined,
      synchronize: legacyConfig.synchronize,
      rotation:
        legacyConfig.rotation != undefined && [0, 90, 180, 270].includes(legacyConfig.rotation)
          ? (legacyConfig.rotation as 0 | 90 | 180 | 270)
          : 0,
      flipHorizontal: legacyConfig.flipHorizontal,
      flipVertical: legacyConfig.flipVertical,
      minValue: legacyConfig.minValue,
      maxValue: legacyConfig.maxValue,
      annotations: Object.fromEntries(
        (legacyConfig.enabledMarkerTopics ?? []).map((topicName) => [topicName, { visible: true }]),
      ),
    },
  };
}

export function migrateLegacyToNewImagePanels(layoutData: LayoutData): LayoutData {
  if (layoutData.layout == undefined) {
    return layoutData;
  }

  const legacyImagePanels = getAllPanelIds(layoutData.layout, layoutData.configById).filter(
    (id) => getPanelTypeFromId(id) === "ImageViewPanel",
  );
  let newState = layoutData;
  for (const id of legacyImagePanels) {
    const legacyConfig = layoutData.configById[id] as LegacyImageConfig | undefined;
    if (legacyConfig != undefined) {
      newState = replacePanel(
        newState,
        id,
        getPanelIdForType("Image"),
        migrateLegacyToNewImageConfig(legacyConfig),
      );
    }
  }
  return newState;
}
