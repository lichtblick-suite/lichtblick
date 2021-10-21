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

import { CameraState } from "@foxglove/regl-worldview";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { ColorOverrideBySourceIdxByVariable } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import { TopicDisplayMode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/types";

export type ThreeDimensionalVizConfig = {
  enableShortDisplayNames?: boolean;
  autoTextBackgroundColor?: boolean;
  cameraState: Partial<CameraState>;
  followTf?: string | false;
  followOrientation?: boolean;
  modifiedNamespaceTopics?: string[];
  pinTopics: boolean;
  diffModeEnabled: boolean;
  topicDisplayMode?: TopicDisplayMode;
  flattenMarkers?: boolean;
  showCrosshair?: boolean;
  expandedKeys: string[];
  checkedKeys: string[];
  settingsByKey: TopicSettingsCollection;
  autoSyncCameraState?: boolean;
  colorOverrideBySourceIdxByVariable?: ColorOverrideBySourceIdxByVariable;
  disableAutoOpenClickedObject?: boolean;
};
