// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MosaicNode } from "react-mosaic-component";

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";

import DefaultMultipleThreeDee from "./layouts/DefaultMultipleThreeDee.json";
import Empty from "./layouts/Empty.json";
import PointcloudMultipleThreeDee from "./layouts/PointcloudMultipleThreeDee.json";
import PointcloudRawMessageAnd3d from "./layouts/PointcloudRawMessageAnd3d.json";
import SinewaveSinglePlot from "./layouts/SinewaveSinglePlot.json";
import TransformPreloading from "./layouts/TransformPreloading.json";

// The layout JSON files are full LayoutData exports (they include a top-level Mosaic `layout`
// tree, not just panel configs) — preserve `layout` too or the Mosaic has no arrangement to render.
// `layout` is typed as `unknown` here because the JSON's inferred shape widens Mosaic's literal
// `direction` union to `string`.
function makeLayoutData(
  partialData: Pick<LayoutData, "configById"> & { layout?: unknown },
): LayoutData {
  return {
    configById: partialData.configById,
    layout: partialData.layout as MosaicNode<string> | undefined,
    globalVariables: {},
    userNodes: {},
    playbackConfig: { speed: 1 },
  };
}

const LAYOUTS: Record<string, LayoutData> = {
  multipleThreeDee: makeLayoutData(DefaultMultipleThreeDee),
  empty: makeLayoutData(Empty),
  sinewave: makeLayoutData(SinewaveSinglePlot),
  pointCloudRawMessage: makeLayoutData(PointcloudRawMessageAnd3d),
  pointCloudMultipleThreeDee: makeLayoutData(PointcloudMultipleThreeDee),
  transformPreloading: makeLayoutData(TransformPreloading),
};

export { LAYOUTS };
