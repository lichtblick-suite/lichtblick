// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SettingsTreeField, Topic } from "@lichtblick/suite";
import { BasicBuilder } from "@lichtblick/test-builders";

import { pointSettingsNode } from "./pointExtensionUtils";

type SettingsTreeFieldWithOptions = SettingsTreeField & {
  options: { label: string; value: string };
};

// Foxglove messages
const RGBA_OPTION = { label: "RGBA (separate fields)", value: "rgba-fields" };
const FOXGLOVE_POINTCLOUD_DATATYPE = "foxglove.PointCloud";
const VALID_MESSAGE_FIELDS = ["red", "blue", "green", "alpha"];

// ROS messages
const BGR_OPTION_ROS = { label: "BGR (packed)", value: "rgb" };
const BGRA_OPTION_ROS = { label: "BGRA (packed)", value: "rgba" };
const ROS_POINTCLOUD_DATATYPE = "sensor_msgs/PointCloud2";

describe("pointExtensionUtils", () => {
  describe("colorModeFields", () => {
    const createTopic = (topicArgs?: Partial<Topic>): Topic => {
      return {
        name: BasicBuilder.string(),
        schemaName: BasicBuilder.string(),
        ...topicArgs,
      };
    };

    it("should include RGBA color mode when topic schema is valid and contains RGBA fields", () => {
      const mockTopic = createTopic({ schemaName: FOXGLOVE_POINTCLOUD_DATATYPE });

      const panelSettings = pointSettingsNode(mockTopic, VALID_MESSAGE_FIELDS, {});
      const colorMode = panelSettings.fields!.colorMode! as SettingsTreeFieldWithOptions;

      expect(colorMode.options).toEqual(expect.arrayContaining([RGBA_OPTION]));
      expect(colorMode.options).toEqual(
        expect.not.arrayContaining([BGR_OPTION_ROS, BGRA_OPTION_ROS]),
      );
    });

    it("should include RGBA color mode when topic is convertible to a valid schema and contains RGBA fields", () => {
      const mockTopic = createTopic({ convertibleTo: [FOXGLOVE_POINTCLOUD_DATATYPE] });

      const panelSettings = pointSettingsNode(mockTopic, VALID_MESSAGE_FIELDS, {});
      const colorMode = panelSettings.fields!.colorMode! as SettingsTreeFieldWithOptions;

      expect(colorMode.options).toEqual(expect.arrayContaining([RGBA_OPTION]));
      expect(colorMode.options).toEqual(
        expect.not.arrayContaining([BGR_OPTION_ROS, BGRA_OPTION_ROS]),
      );
    });

    it("should not include RGBA color mode when topic has no RGBA fields", () => {
      const mockTopic = createTopic({ convertibleTo: [FOXGLOVE_POINTCLOUD_DATATYPE] });

      const panelSettings = pointSettingsNode(mockTopic, [], {});
      const colorMode = panelSettings.fields!.colorMode! as SettingsTreeFieldWithOptions;

      expect(colorMode.options).toEqual(expect.not.arrayContaining([RGBA_OPTION]));
      expect(colorMode.options).toEqual(
        expect.not.arrayContaining([BGR_OPTION_ROS, BGRA_OPTION_ROS]),
      );
    });

    it("should not include RGBA color mode when topic schema is invalid, even with valid RGBA fields", () => {
      const mockTopic = createTopic();

      const panelSettings = pointSettingsNode(mockTopic, VALID_MESSAGE_FIELDS, {});
      const colorMode = panelSettings.fields!.colorMode! as SettingsTreeFieldWithOptions;

      expect(colorMode.options).toEqual(expect.not.arrayContaining([RGBA_OPTION]));
      expect(colorMode.options).toEqual(
        expect.not.arrayContaining([BGR_OPTION_ROS, BGRA_OPTION_ROS]),
      );
    });

    it("should include BGR and BGRA color modes for ROS PointCloud2 messages", () => {
      const mockTopic = createTopic({ schemaName: ROS_POINTCLOUD_DATATYPE });

      const panelSettings = pointSettingsNode(mockTopic, BasicBuilder.strings(), {});
      const colorMode = panelSettings.fields!.colorMode! as SettingsTreeFieldWithOptions;

      expect(colorMode.options).toEqual(expect.arrayContaining([BGR_OPTION_ROS, BGRA_OPTION_ROS]));
      expect(colorMode.options).toEqual(expect.not.arrayContaining([RGBA_OPTION]));
    });

    it("should include BGR and BGRA color modes for ROS PointCloud2 messages from message converter", () => {
      const mockTopic = createTopic({ convertibleTo: [ROS_POINTCLOUD_DATATYPE] });

      const panelSettings = pointSettingsNode(mockTopic, BasicBuilder.strings(), {});
      const colorMode = panelSettings.fields!.colorMode! as SettingsTreeFieldWithOptions;

      expect(colorMode.options).toEqual(expect.arrayContaining([BGR_OPTION_ROS, BGRA_OPTION_ROS]));
      expect(colorMode.options).toEqual(expect.not.arrayContaining([RGBA_OPTION]));
    });
  });
});
