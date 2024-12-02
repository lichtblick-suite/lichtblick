// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { parseMessagePath } from "@lichtblick/message-path";
import { PanelExtensionContext, SettingsTreeAction } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import { stateReducer } from "@lichtblick/suite-base/panels/shared/gaugeAndIndicatorStateReducer";
import { GaugeAndIndicatorState } from "@lichtblick/suite-base/panels/types";

import { getMatchingRule } from "./getMatchingRule";
import { settingsActionReducer, useSettingsTree } from "./settings";
import { Config } from "./types";

type Props = {
  context: PanelExtensionContext;
};

const defaultConfig: Config = {
  path: "",
  style: "bulb",
  fallbackColor: "#a0a0a0",
  fallbackLabel: "False",
  rules: [{ operator: "=", rawValue: "true", color: "#68e24a", label: "True" }],
};

const useStyles = makeStyles()({
  root: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    position: "relative",
    backgroundImage: [
      `radial-gradient(transparent, transparent 55%, rgba(255,255,255,0.4) 80%, rgba(255,255,255,0.4))`,
      `radial-gradient(circle at 38% 35%, rgba(255,255,255,0.8), transparent 30%, transparent)`,
      `radial-gradient(circle at 46% 44%, transparent, transparent 61%, rgba(0,0,0,0.7) 74%, rgba(0,0,0,0.7))`,
    ].join(","),
  },
});

export function Indicator({ context }: Props): React.JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const {
    classes,
    theme: {
      palette: { augmentColor },
    },
  } = useStyles();

  const [config, setConfig] = useState(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const [state, dispatch] = useReducer(
    stateReducer,
    config,
    ({ path }): GaugeAndIndicatorState => ({
      path,
      parsedPath: parseMessagePath(path),
      latestMessage: undefined,
      latestMatchingQueriedData: undefined,
      pathParseError: undefined,
      error: undefined,
    }),
  );

  useLayoutEffect(() => {
    dispatch({ type: "path", path: config.path });
  }, [config.path]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.path === "" ? undefined : config.path);
  }, [config, context]);

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.didSeek === true) {
        dispatch({ type: "seek" });
      }

      if (renderState.currentFrame) {
        dispatch({ type: "frame", messages: renderState.currentFrame });
      }
    };
    context.watch("currentFrame");
    context.watch("didSeek");

    return () => {
      context.onRender = undefined;
    };
  }, [context]);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config, state.pathParseError, state.error?.message);
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  useEffect(() => {
    if (state.parsedPath?.topicName != undefined) {
      context.subscribe([{ topic: state.parsedPath.topicName, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, state.parsedPath?.topicName]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  const rawValue =
    typeof state.latestMatchingQueriedData === "boolean" ||
    typeof state.latestMatchingQueriedData === "bigint" ||
    typeof state.latestMatchingQueriedData === "string" ||
    typeof state.latestMatchingQueriedData === "number"
      ? state.latestMatchingQueriedData
      : undefined;

  const { style, rules, fallbackColor, fallbackLabel } = config;
  const matchingRule = useMemo(() => getMatchingRule(rawValue, rules), [rawValue, rules]);
  return (
    <Stack fullHeight>
      <Stack
        flexGrow={1}
        justifyContent="space-around"
        alignItems="center"
        overflow="hidden"
        padding={1}
        style={{
          backgroundColor:
            style === "background" ? matchingRule?.color ?? fallbackColor : undefined,
        }}
      >
        <Stack direction="row" alignItems="center" gap={2}>
          {style === "bulb" && (
            <div
              className={classes.root}
              style={{ backgroundColor: matchingRule?.color ?? fallbackColor }}
            />
          )}
          <Typography
            color={
              style === "background"
                ? augmentColor({
                    color: { main: matchingRule?.color ?? fallbackColor },
                  }).contrastText
                : matchingRule?.color ?? fallbackColor
            }
            fontFamily="fontMonospace"
            variant="h1"
            whiteSpace="pre"
          >
            {matchingRule?.label ?? fallbackLabel}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
