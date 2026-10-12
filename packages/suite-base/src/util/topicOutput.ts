// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { t } from "i18next";
import * as _ from "lodash-es";

import {
  Immutable,
  MessageEvent,
  SettingsTreeAction,
  Topic,
  TopicOutput,
  TopicOutputDescriptor,
} from "@lichtblick/suite";
import { InstalledMessageConverter } from "@lichtblick/suite-base/types/messageConverters";

export type TopicOutputConfig = {
  topics?: Readonly<Record<string, unknown>>;
  topicOutputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

export type RenderTopic = Topic &
  TopicOutputDescriptor & { label: string; defaultConfig?: unknown };

/** Renderer-local keys; transport topics and message event topic names stay unchanged. */
export function renderTopics(topics: readonly Topic[] | undefined): RenderTopic[] {
  const outputs: RenderTopic[] = [];
  for (const topic of topics ?? []) {
    const original: TopicOutput = { kind: "original", sourceSchemaName: topic.schemaName };
    const multipleSchemas =
      new Set(topics?.filter((entry) => entry.name === topic.name).map((entry) => entry.schemaName))
        .size > 1;
    outputs.push({
      name: multipleSchemas ? topicOutputKey(topic.name, original) : topic.name,
      topic: topic.name,
      schemaName: topic.schemaName,
      output: original,
      convertibleTo: topic.conversionOutputs == undefined ? topic.convertibleTo : undefined,
      label: multipleSchemas
        ? `${t("panelSettings:originalData")} (${topic.schemaName})`
        : t("panelSettings:originalData"),
    });
    for (const conversion of topic.conversionOutputs ?? []) {
      const output: TopicOutput = {
        kind: "converted",
        sourceSchemaName: topic.schemaName,
        converterId: conversion.converterId,
      };
      outputs.push({
        name: topicOutputKey(topic.name, output),
        topic: topic.name,
        schemaName: conversion.schemaName,
        output,
        label: conversion.displayName ?? conversion.schemaName,
        defaultConfig: conversion.defaultConfig,
      });
    }
  }
  return _.uniqBy(outputs, (output) => output.name);
}

export function getConverterId(converter: Immutable<InstalledMessageConverter>): string {
  return (
    converter.converterId ??
    JSON.stringify([
      converter.extensionId ?? "",
      converter.id ?? [converter.fromSchemaName, converter.toSchemaName],
    ])!
  );
}

export function topicOutputKey(topic: string, output: Immutable<TopicOutput>): string {
  return JSON.stringify([
    topic,
    output.sourceSchemaName,
    output.kind,
    output.kind === "converted" ? output.converterId : "",
  ])!;
}

/** Preserve the action discriminator when adapting output paths for legacy handlers. */
export function withSettingsPath(
  action: SettingsTreeAction,
  path: readonly string[],
): SettingsTreeAction {
  switch (action.action) {
    case "update":
      return { ...action, payload: { ...action.payload, path } };
    case "perform-node-action":
      return { ...action, payload: { ...action.payload, path } };
    case "reorder-node":
      return { ...action, payload: { ...action.payload, path } };
  }
}

export function messageOutputKey(
  event: Pick<MessageEvent, "topic" | "schemaName" | "output">,
): string {
  return topicOutputKey(
    event.topic,
    event.output ?? { kind: "original", sourceSchemaName: event.schemaName },
  );
}

export function outputSettingsPath(descriptor: Immutable<TopicOutputDescriptor>): string[] {
  return ["topics", descriptor.topic, topicOutputKey(descriptor.topic, descriptor.output)];
}

/** Always return independent mutable settings; reading never writes to the layout. */
export function resolveOutputConfig(
  config: TopicOutputConfig | undefined,
  descriptor: Immutable<TopicOutputDescriptor>,
  defaults?: unknown,
  panelDefaults?: unknown,
): Record<string, unknown> {
  const override =
    config?.topicOutputs?.[descriptor.topic]?.[topicOutputKey(descriptor.topic, descriptor.output)];
  return _.merge(
    {},
    panelDefaults,
    defaults,
    override == undefined ? config?.topics?.[descriptor.topic] : undefined,
    override,
  );
}
