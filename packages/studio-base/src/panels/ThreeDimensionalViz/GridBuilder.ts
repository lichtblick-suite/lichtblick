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

import { isEqual } from "lodash";

import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import {
  DEFAULT_GRID_COLOR,
  GridSettings,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/GridSettingsEditor";
import { Point, InstancedLineListMarker } from "@foxglove/studio-base/types/Messages";
import { MarkerProvider, MarkerCollector } from "@foxglove/studio-base/types/Scene";
import { FOXGLOVE_GRID_TOPIC } from "@foxglove/studio-base/util/globalConstants";

export default class GridBuilder implements MarkerProvider {
  grid: InstancedLineListMarker;
  private _visible = true;
  private _settings: GridSettings = {};

  constructor() {
    this.grid = GridBuilder.BuildGrid(this._settings);
  }

  renderMarkers = (add: MarkerCollector): void => {
    if (this._visible) {
      add.instancedLineList(this.grid);
    }
  };

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setVisible(isVisible: boolean): void {
    this._visible = isVisible;
  }

  setSettingsByKey(settings: TopicSettingsCollection): void {
    const newSettings = settings[`t:${FOXGLOVE_GRID_TOPIC}`] ?? {};
    if (!isEqual(newSettings, this._settings)) {
      this._settings = newSettings;
      this.grid = GridBuilder.BuildGrid(newSettings);
    }
  }

  static BuildGrid(settings: GridSettings): InstancedLineListMarker {
    const width = settings.width ?? 10;
    const halfWidth = width / 2;
    const subdivisions = settings.subdivisions ?? 9;
    const step = width / (subdivisions + 1);

    const gridPoints: Point[] = [];
    for (let i = 0; i <= subdivisions + 1; i++) {
      gridPoints.push({ x: i * step - halfWidth, y: halfWidth, z: 0 });
      gridPoints.push({ x: i * step - halfWidth, y: -halfWidth, z: 0 });

      gridPoints.push({ x: halfWidth, y: i * step - halfWidth, z: 0 });
      gridPoints.push({ x: -halfWidth, y: i * step - halfWidth, z: 0 });
    }
    const grid: InstancedLineListMarker = {
      type: 108,
      header: { frame_id: "", stamp: { sec: 0, nsec: 0 }, seq: 0 },
      ns: "foxglove",
      id: "grid",
      action: 0,
      pose: {
        position: { x: 0, y: 0, z: settings.heightOffset ?? 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: settings.lineWidth ?? 1, y: 1, z: 1 },
      color: settings.overrideColor ?? DEFAULT_GRID_COLOR,
      frame_locked: false,
      points: gridPoints,
      scaleInvariant: true,
    };
    return grid;
  }
}
