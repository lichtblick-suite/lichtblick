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

// layerIndexes are used to specify the order which markers are drawn
export const LAYER_INDEX_TEXT = 10;
export const LAYER_INDEX_OCCUPANCY_GRIDS = -1;

// When the World is drawn in multiple passes, these values are used
// to set the base for all markers in that render pass.
export const LAYER_INDEX_DEFAULT_BASE = 0;
export const LAYER_INDEX_HIGHLIGHT_OVERLAY = 500;
export const LAYER_INDEX_HIGHLIGHT_BASE = 1000;
export const LAYER_INDEX_DIFF_MODE_BASE_PER_PASS = 100;

export const TRANSFORM_TOPIC = "/tf";
export const TRANSFORM_STAMPED_DATATYPES = [
  "geometry_msgs/TransformStamped",
  "geometry_msgs/msg/TransformStamped",
];
export const TF_DATATYPES = ["tf/tfMessage", "tf2_msgs/TFMessage", "tf2_msgs/msg/TFMessage"];
