// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  DiagnosticInfo,
  DiagnosticStatusArrayMsg,
  DiagnosticStatusConfig,
  DiagnosticStatusMessage,
  KeyValue,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { DiagnosticSummaryConfig } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";
import { Header } from "@lichtblick/suite-base/types/Messages";

class DiagnosticsBuilder {
  public static statusConfig(props: Partial<DiagnosticStatusConfig> = {}): DiagnosticStatusConfig {
    return defaults<DiagnosticStatusConfig>(props, {
      topicToRender: BasicBuilder.string(),
    });
  }

  public static summaryConfig(
    props: Partial<DiagnosticSummaryConfig> = {},
  ): DiagnosticSummaryConfig {
    return defaults<DiagnosticSummaryConfig>(props, {
      hardwareIdFilter: BasicBuilder.string(),
      minLevel: BasicBuilder.number(),
      pinnedIds: BasicBuilder.strings(),
      topicToRender: BasicBuilder.string(),
    });
  }

  public static header(props: Partial<Header> = {}): Header {
    return defaults<Header>(props, {
      frame_id: BasicBuilder.string(),
      stamp: RosTimeBuilder.time(),
      seq: BasicBuilder.number(),
    });
  }

  public static keyValue(props: Partial<KeyValue> = {}): KeyValue {
    return defaults<KeyValue>(props, {
      key: BasicBuilder.string(),
      value: BasicBuilder.string(),
    });
  }

  public static keyValues(count = 3): KeyValue[] {
    return BasicBuilder.multiple(DiagnosticsBuilder.keyValue, count);
  }

  public static statusMessage(
    props: Partial<DiagnosticStatusMessage> = {},
  ): DiagnosticStatusMessage {
    return defaults<DiagnosticStatusMessage>(props, {
      name: BasicBuilder.string(),
      hardware_id: BasicBuilder.string(),
      level: BasicBuilder.number({ min: 0, max: 3 }), // see LEVELS in DiagnosticSummary/constants.ts
      message: BasicBuilder.string(),
      values: DiagnosticsBuilder.keyValues(),
    });
  }

  public static statusMessages(count = 3): DiagnosticStatusMessage[] {
    return BasicBuilder.multiple(DiagnosticsBuilder.statusMessage, count);
  }

  public static statusArrayMsg(
    props: Partial<DiagnosticStatusArrayMsg> = {},
  ): DiagnosticStatusArrayMsg {
    return defaults<DiagnosticStatusArrayMsg>(props, {
      header: DiagnosticsBuilder.header(),
      status: DiagnosticsBuilder.statusMessages(),
    });
  }

  public static info(props: Partial<DiagnosticInfo> = {}): DiagnosticInfo {
    return defaults<DiagnosticInfo>(props, {
      displayName: BasicBuilder.string(),
      id: BasicBuilder.string(),
      status: DiagnosticsBuilder.statusMessage(),
      stamp: RosTimeBuilder.time(),
    });
  }
}

export default DiagnosticsBuilder;
