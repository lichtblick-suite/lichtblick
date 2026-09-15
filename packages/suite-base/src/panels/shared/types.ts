// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

export type DeltaMarkerSeriesValue = {
  configIndex: number;
  value: number | string;
};

export type DeltaMarker = {
  xValue: number;
  seriesValues: DeltaMarkerSeriesValue[];
};

export type DeltaSeriesResult = {
  configIndex: number;
  // Undefined when that marker isn't placed yet (DeltaOverlay shows a placeholder).
  valueAtA: number | string | undefined;
  valueAtB: number | string | undefined;
  // Absolute value; undefined when either value isn't numeric (e.g. StateTransitions state labels).
  delta: number | undefined;
};

export type DeltaResult = {
  /** Absolute value, so it doesn't flip sign depending on which marker was placed first. */
  deltaX: number;
  /** Absolute difference between primary numeric values of both markers, or undefined if non-numeric/missing. */
  deltaY: number | undefined;
  series: DeltaSeriesResult[];
};

export type DeltaDisplay = {
  /** Undefined until both markers are placed. */
  deltaX: number | undefined;
  deltaY: number | undefined;
  series: DeltaSeriesResult[];
};
