// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Terse to save space in layout. c = collapsed, e = expanded.
type NodeExpansion = "all" | "none" | Record<string, "e" | "c">;

export type RawMessagesPanelConfig = {
  diffEnabled: boolean;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  expansion?: NodeExpansion;
  showFullMessageForDiff: boolean;
  topicPath: string;
};

export const Constants = {
  CUSTOM_METHOD: "custom",
  PREV_MSG_METHOD: "previous message",
} as const;
