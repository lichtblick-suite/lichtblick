// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ParameterValue } from "@foxglove/studio";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
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
            ["Uint8Array", new Uint8Array([0, 1])],
            ["array", [1, 2]],
            ["string array", ["one", "two", "three"]],
            ["struct", { a: 1, b: [2, 3], c: "String value" }],
          ])
        : undefined,
    },
  };
};

export default {
  title: "panels/Parameters",
  component: Parameters,
};

export function Default(): JSX.Element {
  return (
    <PanelSetup fixture={getFixture({ getParameters: false, setParameters: false })}>
      <Parameters />
    </PanelSetup>
  );
}

export function WithParameters(): JSX.Element {
  return (
    <PanelSetup fixture={getFixture({ getParameters: true, setParameters: false })}>
      <Parameters />
    </PanelSetup>
  );
}

export function WithEditableParameters(): JSX.Element {
  return (
    <PanelSetup fixture={getFixture({ getParameters: true, setParameters: true })}>
      <Parameters />
    </PanelSetup>
  );
}
