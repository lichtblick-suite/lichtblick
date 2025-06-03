// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";

export type GaugeAndIndicatorState = {
  error: Error | undefined;
  globalVariables: GlobalVariables | undefined;
  latestMatchingQueriedData: unknown;
  latestMessage: MessageEvent | undefined;
  parsedPath: MessagePath | undefined;
  path: string;
  pathParseError: string | undefined;
};

export type FrameAction = { type: "frame"; messages: readonly MessageEvent[] };
export type PathAction = { type: "path"; path: string };
export type SeekAction = { type: "seek" };
export type UpdateGlobalVariablesAction = {
  type: "updateGlobalVariables";
  globalVariables: GlobalVariables;
};
export type GaugeAndIndicatorAction =
  | FrameAction
  | PathAction
  | SeekAction
  | UpdateGlobalVariablesAction;
