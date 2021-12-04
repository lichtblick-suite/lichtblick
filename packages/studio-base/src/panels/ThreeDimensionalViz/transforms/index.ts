// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// REP 105 specifies a set of conventional root frame transform ids
// https://www.ros.org/reps/rep-0105.html
export const DEFAULT_ROOT_FRAME_IDS = ["base_link", "odom", "map", "earth"];

export * from "./CoordinateFrame";
export * from "./Transform";
export * from "./TransformTree";
