// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Time } from "@foxglove/rostime";
import type { Color, Point2D } from "@foxglove/studio-base/types/Messages";

export type PathKey = string | number;

export type CircleAnnotation = {
  type: "circle";
  stamp: Time;
  fillColor?: Color;
  outlineColor?: Color;
  radius: number;
  thickness: number;
  position: Point2D;
  messagePath: PathKey[];
};

export type PointsAnnotation = {
  type: "points";
  stamp: Time;
  style: "points" | "polygon" | "line_strip" | "line_list";
  points: readonly Point2D[];
  outlineColors: readonly Color[];
  outlineColor?: Color;
  thickness: number;
  fillColor?: Color;
  messagePath: PathKey[];
};

export type TextAnnotation = {
  type: "text";
  stamp: Time;
  position: Point2D;
  text: string;
  textColor: Color;
  backgroundColor?: Color;
  fontSize: number;
  padding: number;
  messagePath: PathKey[];
};

export type Annotation = CircleAnnotation | PointsAnnotation | TextAnnotation;
