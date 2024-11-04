// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StateTransitionPath } from "@lichtblick/suite-base/panels/StateTransitions/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";

import { stateTransitionPathDisplayName } from "./shared";

describe("shared functions", () => {
  const randomTimestampMethod = BasicBuilder.sample<TimestampMethod>([
    "receiveTime",
    "headerStamp",
  ]);

  it("should return the path label if it is defined", () => {
    const path: StateTransitionPath = {
      label: BasicBuilder.string(),
      value: BasicBuilder.string(),
      timestampMethod: randomTimestampMethod,
    };
    expect(stateTransitionPathDisplayName(path, 0)).toEqual(path.label);
  });

  it("should return the path value if label is empty", () => {
    const path: StateTransitionPath = {
      label: "",
      value: BasicBuilder.string(),
      timestampMethod: randomTimestampMethod,
    };
    expect(stateTransitionPathDisplayName(path, 0)).toEqual(path.value);
  });

  it("should return the path value if label is undefined", () => {
    const path: StateTransitionPath = {
      label: undefined,
      value: BasicBuilder.string(),
      timestampMethod: randomTimestampMethod,
    };
    expect(stateTransitionPathDisplayName(path, 0)).toEqual(path.value);
  });

  it("should return the fallback display name if neither label or value are empty", () => {
    const path: StateTransitionPath = {
      label: "",
      value: "",
      timestampMethod: randomTimestampMethod,
    };
    expect(stateTransitionPathDisplayName(path, 0)).toEqual("Series 1");
    expect(stateTransitionPathDisplayName(path, 1)).toEqual("Series 2");
    expect(stateTransitionPathDisplayName(path, 42)).toEqual("Series 43");
  });
});
