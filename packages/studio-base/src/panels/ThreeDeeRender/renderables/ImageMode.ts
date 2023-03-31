// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { set } from "lodash";

import { filterMap } from "@foxglove/den/collection";
import { SettingsTreeAction } from "@foxglove/studio";

import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import {
  CAMERA_CALIBRATION_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES,
  RAW_IMAGE_DATATYPES,
} from "../foxglove";
import {
  IMAGE_DATATYPES as ROS_IMAGE_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES as ROS_COMPRESSED_IMAGE_DATATYPES,
  CAMERA_INFO_DATATYPES,
} from "../ros";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";

const IMAGE_TOPIC_PATH = ["imageMode", "imageTopic"];
const CALIBRATION_TOPIC_PATH = ["imageMode", "calibrationTopic"];

const IMAGE_TOPIC_UNAVAILABLE = "IMAGE_TOPIC_UNAVAILABLE";
const CALIBRATION_TOPIC_UNAVAILABLE = "CALIBRATION_TOPIC_UNAVAILABLE";

export class ImageMode extends SceneExtension {
  public constructor(renderer: Renderer) {
    super("foxglove.ImageMode", renderer);

    renderer.settings.errors.on("update", this.handleErrorChange);
    renderer.settings.errors.on("clear", this.handleErrorChange);
    renderer.settings.errors.on("remove", this.handleErrorChange);
  }

  public override dispose(): void {
    this.renderer.settings.errors.off("update", this.handleErrorChange);
    this.renderer.settings.errors.off("clear", this.handleErrorChange);
    this.renderer.settings.errors.off("remove", this.handleErrorChange);
    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const handler = this.handleSettingsAction;

    const { imageTopic, calibrationTopic } = config.imageMode;

    const imageTopics = filterMap(this.renderer.topics ?? [], (topic) => {
      if (
        !(
          topicIsConvertibleToSchema(topic, ROS_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, ROS_COMPRESSED_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, RAW_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, COMPRESSED_IMAGE_DATATYPES)
        )
      ) {
        return;
      }
      return { label: topic.name, value: topic.name };
    });

    const calibrationTopics = filterMap(this.renderer.topics ?? [], (topic) => {
      if (
        !(
          topicIsConvertibleToSchema(topic, CAMERA_INFO_DATATYPES) ||
          topicIsConvertibleToSchema(topic, CAMERA_CALIBRATION_DATATYPES)
        )
      ) {
        return;
      }
      return { label: topic.name, value: topic.name };
    });

    if (imageTopic && !imageTopics.some((topic) => topic.value === imageTopic)) {
      this.renderer.settings.errors.add(
        IMAGE_TOPIC_PATH,
        IMAGE_TOPIC_UNAVAILABLE,
        `${imageTopic} is not available`,
      );
    } else {
      this.renderer.settings.errors.remove(IMAGE_TOPIC_PATH, IMAGE_TOPIC_UNAVAILABLE);
    }

    if (calibrationTopic && !calibrationTopics.some((topic) => topic.value === calibrationTopic)) {
      this.renderer.settings.errors.add(
        CALIBRATION_TOPIC_PATH,
        CALIBRATION_TOPIC_UNAVAILABLE,
        `${calibrationTopic} is not available`,
      );
    } else {
      this.renderer.settings.errors.remove(CALIBRATION_TOPIC_PATH, CALIBRATION_TOPIC_UNAVAILABLE);
    }

    const imageTopicError = this.renderer.settings.errors.errors.errorAtPath(IMAGE_TOPIC_PATH);
    const calibrationTopicError =
      this.renderer.settings.errors.errors.errorAtPath(CALIBRATION_TOPIC_PATH);

    // Not yet implemented
    const transformMarkers: boolean = false;
    const synchronize: boolean = false;
    const smooth: boolean = false;
    const flipHorizontal: boolean = false;
    const flipVertical: boolean = false;
    const rotation = 0;
    const minValue: number | undefined = undefined;
    const maxValue: number | undefined = undefined;

    return [
      {
        path: ["imageMode"],
        node: {
          label: "General",
          defaultExpansionState: "expanded",
          handler,
          fields: {
            imageTopic: {
              label: "Topic",
              input: "select",
              value: imageTopic,
              options: imageTopics,
              error: imageTopicError,
            },
            calibrationTopic: {
              label: "Calibration",
              input: "select",
              value: config.imageMode.calibrationTopic,
              options: calibrationTopics,
              error: calibrationTopicError,
            },
            TODO_transformMarkers: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Transform markers",
              value: transformMarkers,
              help: (transformMarkers as boolean)
                ? "Markers are being transformed by Foxglove Studio based on the camera model. Click to turn it off."
                : `Markers can be transformed by Foxglove Studio based on the camera model. Click to turn it on.`,
            },
            TODO_synchronize: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Synchronize timestamps",
              value: synchronize,
            },
            TODO_smooth: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Bilinear smoothing",
              value: smooth,
            },
            TODO_flipHorizontal: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Flip horizontal",
              value: flipHorizontal,
            },
            TODO_flipVertical: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Flip vertical",
              value: flipVertical,
            },
            TODO_rotation: {
              readonly: true, // not yet implemented
              input: "select",
              label: "🚧 Rotation",
              value: rotation,
              options: [
                { label: "0°", value: 0 },
                { label: "90°", value: 90 },
                { label: "180°", value: 180 },
                { label: "270°", value: 270 },
              ],
            },
            TODO_minValue: {
              readonly: true, // not yet implemented
              input: "number",
              label: "🚧 Min (depth images)",
              placeholder: "0",
              value: minValue,
            },
            TODO_maxValue: {
              readonly: true, // not yet implemented
              input: "number",
              label: "🚧 Max (depth images)",
              placeholder: "10000",
              value: maxValue,
            },
          },
        },
      },
    ];
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    if (action.action !== "update" || action.payload.path.length === 0) {
      return;
    }

    const path = action.payload.path;
    const category = path[0]!;
    const value = action.payload.value;
    if (category === "imageMode") {
      this.renderer.updateConfig((draft) => set(draft, path, value));
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  private handleErrorChange = (): void => {
    this.updateSettingsTree();
  };
}
