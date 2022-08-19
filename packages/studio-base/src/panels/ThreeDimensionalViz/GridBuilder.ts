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

import { toRGBA } from "@foxglove/regl-worldview";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import {
  DEFAULT_GRID_COLOR,
  GridSettings,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/GridSettingsEditor";
import { GlLineListMarker } from "@foxglove/studio-base/types/Messages";
import { FOXGLOVE_GRID_TOPIC } from "@foxglove/studio-base/util/globalConstants";

import { MarkerProvider, RenderMarkerArgs } from "./types";

export default class GridBuilder implements MarkerProvider {
  private grid: GlLineListMarker;
  private _visible = true;
  private _settings: GridSettings = {};

  public constructor() {
    this.grid = GridBuilder.BuildGrid(this._settings);
  }

  public renderMarkers = (args: RenderMarkerArgs): void => {
    if (this._visible) {
      args.add.glLineList(this.grid);
    }
  };

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setVisible(isVisible: boolean): void {
    this._visible = isVisible;
  }

  public setSettingsByKey(settings: TopicSettingsCollection): void {
    const newSettings = settings[`t:${FOXGLOVE_GRID_TOPIC}`] ?? {};
    if (!isEqual(newSettings, this._settings)) {
      this._settings = newSettings;
      this.grid = GridBuilder.BuildGrid(newSettings);
    }
  }

  public static BuildGrid(settings: GridSettings): GlLineListMarker {
    const width = settings.width ?? 10;
    const halfWidth = width / 2;
    const subdivisions = settings.subdivisions ?? 9;
    const step = width / (subdivisions + 1);

    const z = settings.heightOffset ?? 0;
    const points = new Float32Array(4 * 3 * (subdivisions + 1 + 1));
    for (let i = 0; i <= subdivisions + 1; i++) {
      points[(i * 4 + 0) * 3 + 0] = i * step - halfWidth;
      points[(i * 4 + 0) * 3 + 1] = halfWidth;
      points[(i * 4 + 0) * 3 + 2] = z;
      points[(i * 4 + 1) * 3 + 0] = i * step - halfWidth;
      points[(i * 4 + 1) * 3 + 1] = -halfWidth;
      points[(i * 4 + 1) * 3 + 2] = z;

      points[(i * 4 + 2) * 3 + 0] = halfWidth;
      points[(i * 4 + 2) * 3 + 1] = i * step - halfWidth;
      points[(i * 4 + 2) * 3 + 2] = z;
      points[(i * 4 + 3) * 3 + 0] = -halfWidth;
      points[(i * 4 + 3) * 3 + 1] = i * step - halfWidth;
      points[(i * 4 + 3) * 3 + 2] = z;
    }
    return {
      color: Float32Array.from(toRGBA(settings.overrideColor ?? DEFAULT_GRID_COLOR)),
      points,
    };
  }
}
