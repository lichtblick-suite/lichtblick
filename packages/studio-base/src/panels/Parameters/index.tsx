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

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { union } from "lodash";
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { useDebouncedCallback } from "use-debounce";

import { ParameterValue } from "@foxglove/studio";
import CopyButton from "@foxglove/studio-base/components/CopyButton";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import JsonInput from "@foxglove/studio-base/components/JsonInput";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";

// The minimum amount of time to wait between showing the parameter update animation again
export const ANIMATION_RESET_DELAY_MS = 3000;

function isActiveElementEditable(): boolean {
  const activeEl = document.activeElement;
  return (
    activeEl != undefined &&
    ((activeEl as HTMLElement).isContentEditable ||
      activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA")
  );
}

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

const useStyles = makeStyles<void, "copyIcon">()((_theme, _params, classes) => ({
  tableRow: {
    [`&:hover .${classes.copyIcon}`]: {
      visibility: "visible",
    },
  },
  copyIcon: {
    visibility: "hidden",

    "&:hover": {
      backgroundColor: "transparent",
    },
  },
}));

function Parameters(): ReactElement {
  const { classes } = useStyles();

  const capabilities = useMessagePipeline(selectCapabilities);
  const setParameterUnbounced = useMessagePipeline(selectSetParameter);
  const parameters = useMessagePipeline(selectParameters);

  const setParameter = useDebouncedCallback(
    useCallback(
      (name: string, value: ParameterValue) => setParameterUnbounced(name, value),
      [setParameterUnbounced],
    ),
    200,
  );

  const [changedParameters, setChangedParameters] = useState<string[]>([]);

  const canGetParams = capabilities.includes(PlayerCapabilities.getParameters);
  const canSetParams = capabilities.includes(PlayerCapabilities.setParameters);

  const parameterNames = useMemo(() => Array.from(parameters.keys()), [parameters]);

  // Don't run the animation when the Table first renders
  const skipAnimation = useRef<boolean>(true);
  const previousParametersRef = useRef<Map<string, unknown> | undefined>(parameters);

  useEffect(() => {
    const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (skipAnimation.current || isActiveElementEditable()) {
      previousParametersRef.current = parameters;
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
    previousParametersRef.current = parameters;
    const timerId = setTimeout(() => setChangedParameters([]), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [parameters, skipAnimation]);

  if (!canGetParams) {
    return (
      <Stack fullHeight>
        <PanelToolbar />
        <EmptyState>Connect to a ROS source to view parameters</EmptyState>
      </Stack>
    );
  }

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <TableContainer style={{ flex: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Parameter</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>&nbsp;</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parameterNames.map((name) => {
              const value = JSON.stringify(parameters.get(name)) ?? "";

              return (
                <TableRow
                  hover
                  className={classes.tableRow}
                  key={`parameter-${name}`}
                  selected={!skipAnimation.current && changedParameters.includes(name)}
                >
                  <TableCell variant="head">
                    <Typography noWrap title={name} variant="inherit">
                      {name}
                    </Typography>
                  </TableCell>

                  {canSetParams ? (
                    <TableCell padding="none">
                      <JsonInput
                        dataTestId={`parameter-value-input-${value}`}
                        value={value}
                        onChange={(newVal) => {
                          setParameter(name, newVal as ParameterValue);
                        }}
                      />
                    </TableCell>
                  ) : (
                    <TableCell>
                      <Typography noWrap title={value} variant="inherit" color="text.secondary">
                        {value}
                      </Typography>
                    </TableCell>
                  )}

                  <TableCell padding="none" align="center">
                    <CopyButton
                      className={classes.copyIcon}
                      edge="end"
                      size="small"
                      iconSize="small"
                      value={`${name}: ${value}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

Parameters.panelType = "Parameters";
Parameters.defaultConfig = {
  title: "Parameters",
};

export default Panel(Parameters);
