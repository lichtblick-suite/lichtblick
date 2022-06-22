// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SettingsTreeFields, SettingsTreeNodes } from "@foxglove/studio";

import { ThreeDimensionalVizConfig } from "./types";

export function buildSettingsTree(config: ThreeDimensionalVizConfig): SettingsTreeNodes {
  const rootFields: SettingsTreeFields = {
    flattenMarkers: {
      label: "Flatten markers",
      input: "boolean",
      value: config.flattenMarkers ?? false,
      help: "Flatten markers with a z-value of 0 to be located at the base frame's z value",
    },
    autoTextBackgroundColor: {
      label: "Auto text background",
      input: "boolean",
      value: config.autoTextBackgroundColor,
      help: "Automatically apply dark/light background color to text",
    },
    useThemeBackgroundColor: {
      label: "Auto background",
      input: "boolean",
      value: config.useThemeBackgroundColor,
      help: "Automatically determine background color based on the color scheme",
    },
  };

  if (!config.useThemeBackgroundColor) {
    rootFields.customBackgroundColor = {
      label: "Background color",
      input: "rgba",
      value: config.customBackgroundColor,
    };
  }

  return {
    general: {
      label: "General",
      icon: "Settings",
      fields: rootFields,
    },
    meshRendering: {
      label: "Mesh rendering",
      fields: {
        ignoreColladaUpAxis: {
          label: "Ignore COLLADA up_axis",
          input: "boolean",
          value: config.ignoreColladaUpAxis ?? false,
          help: "Ignore <up_axis> in COLLADA meshes",
        },
      },
    },
    publish: {
      label: "Publish",
      fields: {
        clickToPublishPoseEstimateTopic: {
          label: "Pose estimate topic",
          input: "string",
          value: config.clickToPublishPoseEstimateTopic,
          help: "The topic on which to publish pose estimates",
        },
        clickToPublishPoseTopic: {
          label: "Pose topic",
          input: "string",
          value: config.clickToPublishPoseTopic,
          help: "The topic on which to publish poses",
        },
        clickToPublishPointTopic: {
          label: "Point topic",
          input: "string",
          value: config.clickToPublishPointTopic,
          help: "The topic on which to publish points",
        },
        clickToPublishPoseEstimateXDeviation: {
          label: "X deviation",
          input: "number",
          value: config.clickToPublishPoseEstimateXDeviation,
          help: "The X standard deviation to publish with poses",
        },
        clickToPublishPoseEstimateYDeviation: {
          label: "Y deviation",
          input: "number",
          value: config.clickToPublishPoseEstimateYDeviation,
          help: "The Y standard deviation to publish with poses",
        },
        clickToPublishPoseEstimateThetaDeviation: {
          label: "Theta deviation",
          input: "number",
          value: config.clickToPublishPoseEstimateThetaDeviation,
          help: "The theta standard deviation to publish with poses",
        },
      },
    },
  };
}
