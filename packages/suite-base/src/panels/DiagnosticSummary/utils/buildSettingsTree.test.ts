// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import {
  SettingsTreeField,
  SettingsTreeFieldNumber,
  SettingsTreeFieldSelectString,
  SettingsTreeNodes,
} from "@lichtblick/suite";
import { DEFAULT_SETTINGS_TREE_NODE } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { buildSettingsTree } from "./buildSettingsTree";

describe("buildSettingsTree", () => {
  it("should build settings tree with valid topicToRender", () => {
    // Given
    const topics = BasicBuilder.strings({ count: 2 });
    const config = DiagnosticsBuilder.summaryConfig({
      sortByLevel: BasicBuilder.boolean(),
      secondsUntilStale: BasicBuilder.number(),
    });

    // When
    const result: SettingsTreeNodes = buildSettingsTree({
      availableTopics: topics,
      config,
      topicToRender: topics[0]!,
    });

    // Then
    const { label: defaultLabel, fields: defaultFields } = DEFAULT_SETTINGS_TREE_NODE.general!;
    const { fields: fieldsResult } = result.general!;
    expect(result.general?.label).toEqual(defaultLabel);
    expect(fieldsResult?.topicToRender).toEqual({
      input: "select",
      label: defaultFields?.topicToRender!.label,
      value: topics[0],
      error: undefined,
      options: [
        { label: topics[0], value: topics[0] },
        { label: topics[1], value: topics[1] },
      ],
    });
    expect(fieldsResult?.sortByLevel).toEqual({
      input: "boolean",
      label: defaultFields?.sortByLevel!.label,
      value: config.sortByLevel,
    });
    expect(fieldsResult?.secondsUntilStale).toEqual({
      input: "number",
      label: defaultFields?.secondsUntilStale!.label,
      help: defaultFields?.secondsUntilStale!.help,
      min: (defaultFields?.secondsUntilStale as SettingsTreeFieldNumber).min,
      placeholder: (defaultFields?.secondsUntilStale as SettingsTreeFieldNumber).placeholder,
      precision: (defaultFields?.secondsUntilStale as SettingsTreeFieldNumber).precision,
      step: (defaultFields?.secondsUntilStale as SettingsTreeFieldNumber).step,
      value: config.secondsUntilStale,
    });
  });

  it("should include topicToRender in options and set error if topic is not available", () => {
    // Given
    const config = DiagnosticsBuilder.summaryConfig({
      sortByLevel: BasicBuilder.boolean(),
      secondsUntilStale: BasicBuilder.number(),
    });
    const topics = BasicBuilder.strings({ count: 3 }) as [string, string, string];

    // When
    const result: SettingsTreeNodes = buildSettingsTree({
      availableTopics: [topics[1], topics[2]],
      config,
      topicToRender: topics[0],
    });

    // Then
    const { fields: fieldsResult } = result.general!;
    expect(fieldsResult?.topicToRender?.error).toEqual(`Topic ${topics[0]} is not available`);
  });

  it("should handle empty availableTopics array", () => {
    // Given
    const config = DiagnosticsBuilder.summaryConfig({
      sortByLevel: BasicBuilder.boolean(),
      secondsUntilStale: BasicBuilder.number(),
    });
    const topicToRender = BasicBuilder.string();

    // When
    const result: SettingsTreeNodes = buildSettingsTree({
      availableTopics: [],
      config,
      topicToRender,
    });

    // Then
    const topicToRenderResult = result.general?.fields?.topicToRender as SettingsTreeField &
      SettingsTreeFieldSelectString;
    expect(topicToRenderResult.options).toEqual([{ value: topicToRender, label: topicToRender }]);
    expect(topicToRenderResult.error).toEqual(`Topic ${topicToRender} is not available`);
  });
});
