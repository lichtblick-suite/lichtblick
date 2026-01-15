/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Topic } from "@lichtblick/suite";
import { buildSettingsTreeTeleop } from "@lichtblick/suite-base/panels/Teleop/buildSettingsTree";
import { geometryMsgOptions } from "@lichtblick/suite-base/panels/Teleop/constants";
import { TeleopConfig } from "@lichtblick/suite-base/panels/Teleop/types";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("buildSettingsTree for TeleopPanel", () => {
  const publishRate = BasicBuilder.number();
  const topic = BasicBuilder.string();
  const defaultConfig: TeleopConfig = {
    publishRate,
    topic,
    upButton: { field: "linear.x", value: 1 },
    downButton: { field: "linear.x", value: -1 },
    leftButton: { field: "angular.z", value: 1 },
    rightButton: { field: "angular.z", value: -1 },
  };

  const sampleTopics = [
    PlayerBuilder.topic({ name: "topic1", schemaName: "geometry_msgs/Twist" }),
    PlayerBuilder.topic({ name: "topic2", schemaName: "geometry_msgs/Twist" }),
  ] as Readonly<Topic[]>;

  it("should build settings tree with valid config and topics", () => {
    // Given
    const config = { ...defaultConfig };

    // When
    const result = buildSettingsTreeTeleop(config, sampleTopics);

    // Then
    expect(result.general).toBeDefined();
    expect(result.general?.fields).toEqual({
      publishRate: { label: "Publish rate", input: "number", value: publishRate },
      topic: {
        label: "Topic",
        input: "autocomplete",
        value: topic,
        items: ["topic1", "topic2"],
      },
    });
  });

  it("should configure all directional buttons correctly", () => {
    // Given
    const customConfig: TeleopConfig = {
      ...defaultConfig,
      upButton: { field: "linear.x", value: 1.5 },
      downButton: { field: "linear.y", value: -2.0 },
      leftButton: { field: "angular.z", value: 3.0 },
      rightButton: { field: "linear.z", value: -4.0 },
    };

    // When
    const result = buildSettingsTreeTeleop(customConfig, sampleTopics);

    // Then
    const { children } = result.general!;
    expect(children).toBeDefined();

    // Check each button configuration
    const buttons = ["upButton", "downButton", "leftButton", "rightButton"] as const;
    const expectedValues = [1.5, -2.0, 3.0, -4.0];
    const expectedFields = ["linear.x", "linear.y", "angular.z", "linear.z"];

    buttons.forEach((button, index) => {
      expect(children!).toBeDefined();
      expect(children![button]).toEqual({
        label: button.replace("Button", " Button").replace(/^./, (str) => str.toUpperCase()),
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: expectedFields[index],
            options: geometryMsgOptions,
          },
          value: {
            label: "Value",
            input: "number",
            value: expectedValues[index],
          },
        },
      });
    });
  });

  it("should handle empty topics array", () => {
    // Given
    const config = defaultConfig;

    // When
    const result = buildSettingsTreeTeleop(config, []);

    // Then
    expect(result.general!.fields!.topic).toEqual({
      label: "Topic",
      input: "autocomplete",
      value: topic,
      items: [],
    });
  });

  it("should include correct geometry message options in all button fields", () => {
    // Given
    const config = defaultConfig;

    // When
    const result = buildSettingsTreeTeleop(config, []);

    // Then
    const buttons = ["upButton", "downButton", "leftButton", "rightButton"] as const;
    buttons.forEach((button) => {
      const buttonField: any = result.general?.children?.[button]?.fields?.field;
      expect(buttonField?.input).toBe("select");
      expect(buttonField?.options).toBe(geometryMsgOptions);
    });
  });
});
