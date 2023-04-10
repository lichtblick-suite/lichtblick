// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { SettingsTreeField } from "@foxglove/studio";

export type SelectEntry = { label: string; value: string };

export type TwoColors = [string, string];
export type Vec3 = [number, number, number];

/**
 * Common settings for all persisted SceneExtension settings.
 */
export type BaseSettings = {
  /** Visibility for any associated scene renderables and settings tree nodes. */
  visible: boolean;
  /** If true, always use `currentTime` for pose updates. This means objects in a coordinate frame
   * will move as the coordinate frame moves. */
  frameLocked?: boolean;
};

export type LayerSettingsEntity = BaseSettings & {
  showOutlines: boolean | undefined;
  color: string | undefined;
  selectedIdVariable: string | undefined;
};

/**
 * Settings for a "Custom Layer", a user-added collection of one or more renderables such as a Grid.
 */
export type CustomLayerSettings = BaseSettings & {
  /** An identifier for a unique instance of a layer. */
  instanceId: string;
  /** An identifier for a type of layer, such as `"foxglove.Grid"`. */
  layerId: string;
  /** The label to use for this layer in the settings tree, under "Custom Layers". */
  label: string;
  /** Optional value specifying order in the custom layer list */
  order?: number;
};

export const PRECISION_DISTANCE = 3; // [1mm]
export const PRECISION_DEGREES = 1;

export function fieldSize(
  label: string,
  value: number | undefined,
  placeholder?: string | number,
): SettingsTreeField {
  return {
    label,
    input: "number",
    min: 0,
    step: 0.5,
    precision: PRECISION_DISTANCE,
    value,
    placeholder: String(placeholder),
  };
}

export function fieldScaleVec3(label: string, value: Vec3): SettingsTreeField {
  return {
    label,
    input: "vec3",
    labels: ["X", "Y", "Z"],
    step: 0.5,
    precision: PRECISION_DISTANCE,
    value,
  };
}

export function fieldLineWidth(
  label: string,
  value: number | undefined,
  placeholder?: string | number,
): SettingsTreeField {
  return {
    label,
    input: "number",
    min: 0,
    step: 0.005,
    precision: 4,
    value,
    placeholder: String(placeholder),
  };
}

export function fieldGradient(label: string, value: TwoColors): SettingsTreeField {
  return { label, input: "gradient", value };
}
