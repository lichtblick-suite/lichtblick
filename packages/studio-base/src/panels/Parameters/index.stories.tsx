// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { useState } from "react";

import { ParameterValue } from "@foxglove/studio";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import Parameters from "./index";

const DEFAULT_PARAMS = new Map<string, ParameterValue>([
  ["undefined", undefined],
  ["boolean", false],
  ["number", -42],
  ["string", "Hello, world!"],
  ["date", new Date(1618876820517)],
  ["Uint8Array", new Uint8Array([0, 1])],
  ["array", [1, 2]],
  ["string array", ["one", "two", "three"]],
  ["struct", { a: 1, b: [2, 3], c: "String value" }],
]);

const getFixture = ({
  getParameters,
  setParameters,
  parameters,
  setParameterValues,
}: {
  getParameters: boolean;
  setParameters: boolean;
  parameters?: Map<string, ParameterValue>;
  setParameterValues?: (params: Map<string, ParameterValue>) => void;
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
      parameters: getParameters ? parameters : undefined,
    },
    setParameter:
      setParameters && setParameterValues
        ? (key: string, value: ParameterValue) => {
            const params = new Map<string, ParameterValue>(parameters);
            params.set(key, value);
            setParameterValues(params);
          }
        : undefined,
  };
};

export default {
  title: "panels/Parameters",
  component: Parameters,
};

export const Default: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={getFixture({ getParameters: false, setParameters: false })}>
        <Parameters />
      </PanelSetup>
    );
  },
};

export const WithParameters: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={getFixture({
          getParameters: true,
          setParameters: false,
          parameters: DEFAULT_PARAMS,
        })}
      >
        <Parameters />
      </PanelSetup>
    );
  },
};

const EditableParameters = () => {
  const [parameters, setParameterValues] = useState(DEFAULT_PARAMS);

  return (
    <PanelSetup
      fixture={getFixture({
        getParameters: true,
        setParameters: true,
        parameters,
        setParameterValues,
      })}
    >
      <Parameters />
    </PanelSetup>
  );
};

export const WithEditableParameters: StoryObj = {
  render: () => <EditableParameters />,
};
