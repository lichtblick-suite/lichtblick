// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { union } from "lodash";
import { ReactElement, useEffect, useMemo, useRef, useState } from "react";

import { ParameterValue } from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { isActiveElementEditable } from "@foxglove/studio-base/components/GlobalVariablesTable";
import { LegacyTable } from "@foxglove/studio-base/components/LegacyStyledComponents";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { JSONInput } from "@foxglove/studio-base/components/input/JSONInput";
import { usePreviousValue } from "@foxglove/studio-base/hooks/usePreviousValue";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";

import AnimatedRow from "./AnimatedRow";
import ParametersPanel from "./ParametersPanel";
import ParametersTable from "./ParametersTable";
import Scrollable from "./Scrollable";
import helpContent from "./index.help.md";

// The minimum amount of time to wait between showing the parameter update animation again
export const ANIMATION_RESET_DELAY_MS = 3000;

// Keep a single empty map so selector return value is reference-equal
const EMPTY_PARAMETERS = new Map<string, ParameterValue>();

function selectCapabilities(ctx: MessagePipelineContext) {
  return ctx.playerState.capabilities;
}
function selectSetParameter(ctx: MessagePipelineContext) {
  return ctx.setParameter;
}
function selectParameters(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.parameters ?? EMPTY_PARAMETERS;
}

function Parameters(): ReactElement {
  const capabilities = useMessagePipeline(selectCapabilities);
  const setParameter = useMessagePipeline(selectSetParameter);
  const parameters = useMessagePipeline(selectParameters);

  const canGetParams = capabilities.includes(PlayerCapabilities.getParameters);
  const canSetParams = capabilities.includes(PlayerCapabilities.setParameters);

  const parameterNames = useMemo(() => Array.from(parameters.keys()), [parameters]);

  // Don't run the animation when the Table first renders
  const skipAnimation = useRef<boolean>(true);
  useEffect(() => {
    const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  const previousParameters = usePreviousValue(parameters);
  const previousParametersRef = useRef<Map<string, unknown> | undefined>(previousParameters);
  previousParametersRef.current = previousParameters;

  const [changedParameters, setChangedParameters] = useState<string[]>([]);
  useEffect(() => {
    if (skipAnimation.current || isActiveElementEditable()) {
      return;
    }
    const newChangedParameters = union(
      Array.from(parameters.keys()),
      Array.from(previousParametersRef.current?.keys() ?? []),
    ).filter((name) => {
      const previousValue = previousParametersRef.current?.get(name);
      return previousValue !== parameters.get(name);
    });

    setChangedParameters(newChangedParameters);
    const timerId = setTimeout(() => setChangedParameters([]), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [parameters, skipAnimation]);

  if (!canGetParams) {
    return (
      <>
        <PanelToolbar floating helpContent={helpContent} />
        <EmptyState>Connect to a ROS source to view parameters</EmptyState>
      </>
    );
  }

  return (
    <ParametersPanel>
      <PanelToolbar helpContent={helpContent} floating />
      <Scrollable>
        <ParametersTable>
          <LegacyTable>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {parameterNames.map((name) => {
                const value = JSON.stringify(parameters.get(name) ?? "");
                return (
                  <AnimatedRow
                    key={`parameter-${name}`}
                    skipAnimation={skipAnimation.current}
                    animate={changedParameters.includes(name)}
                  >
                    <td>{name}</td>
                    <td width="100%">
                      {canSetParams ? (
                        <JSONInput
                          dataTest={`parameter-value-input-${value}`}
                          value={value}
                          onChange={(newVal) => setParameter(name, newVal as ParameterValue)}
                        />
                      ) : (
                        value
                      )}
                    </td>
                  </AnimatedRow>
                );
              })}
            </tbody>
          </LegacyTable>
        </ParametersTable>
      </Scrollable>
    </ParametersPanel>
  );
}

Parameters.panelType = "Parameters";
Parameters.defaultConfig = {};
Parameters.supportsStrictMode = false;

export default Panel(Parameters);
