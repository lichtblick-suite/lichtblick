// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { storiesOf } from "@storybook/react";

import { ParameterValue, PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import Parameters from "./index";

const getFixture = ({
  getParameters,
  setParameters,
}: {
  getParameters: boolean;
  setParameters: boolean;
}) => {
  const capabilities: string[] = [];
  if (getParameters) {
    capabilities.push(PlayerCapabilities.getParameters);
  }
  if (setParameters) {
    capabilities.push(PlayerCapabilities.setParameters);
  }

  return {
    topics: [],
    frame: {},
    capabilities,
    activeData: {
      parameters: getParameters
        ? new Map<string, ParameterValue>([
            ["undefined", undefined],
            ["boolean", false],
            ["number", -42],
            ["string", "Hello, world!"],
            ["date", new Date(1618876820517)],
            ["Uint8Array", new Uint8Array([0, 1, 2, 3, 4, 5])],
            ["array", [1, true, "abc"]],
            ["struct", { a: 1, b: [2, 3, 4], c: "String value" }],
          ])
        : undefined,
    },
  };
};

storiesOf("panels/Parameters", module)
  .add("default", () => {
    return (
      <PanelSetup fixture={getFixture({ getParameters: false, setParameters: false })}>
        <Parameters />
      </PanelSetup>
    );
  })
  .add("with parameters", () => {
    return (
      <PanelSetup fixture={getFixture({ getParameters: true, setParameters: false })}>
        <Parameters />
      </PanelSetup>
    );
  });
