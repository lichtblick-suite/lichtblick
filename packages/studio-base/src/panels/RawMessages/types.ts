// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Terse to save space in layout. c = collapsed, e = expanded.
export enum NodeState {
  Collapsed = "c",
  Expanded = "e",
}

export type NodeExpansion = "all" | "none" | Record<string, NodeState>;

export type RawMessagesPanelConfig = {
  diffEnabled: boolean;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  expansion?: NodeExpansion;
  showFullMessageForDiff: boolean;
  topicPath: string;
  fontSize: number | undefined;
};

export const Constants = {
  CUSTOM_METHOD: "custom",
  PREV_MSG_METHOD: "previous message",
  FONT_SIZE_OPTIONS: [8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72],
} as const;
