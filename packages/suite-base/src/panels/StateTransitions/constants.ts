// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartOptions } from "chart.js";

import { MessageDataItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { StateTransitionPath } from "@lichtblick/suite-base/panels/StateTransitions/types";
import { fontMonospace } from "@lichtblick/theme";

export const EMPTY_ITEMS_BY_PATH: MessageDataItemsByPath = {};

export const DEFAULT_STATE_TRANSITION_PATH: StateTransitionPath = Object.freeze({
  value: "",
  timestampMethod: "receiveTime",
});

export const STATE_TRANSITION_PLUGINS: ChartOptions["plugins"] = {
  datalabels: {
    display: "auto",
    anchor: "center",
    align: -45,
    offset: 0,
    clip: true,
    font: {
      family: fontMonospace,
      size: 10,
      weight: "bold",
    },
  },
  zoom: {
    zoom: {
      enabled: true,
      mode: "x",
      sensitivity: 3,
      speed: 0.1,
    },
    pan: {
      mode: "x",
      enabled: true,
      speed: 20,
      threshold: 10,
    },
  },
};

export const TRANSITIONABLE_ROS_TYPES = [
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "string",
];
