// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { SettingsTreeAction } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { useStyles } from "@lichtblick/suite-base/panels/Indicator/Indicator.style";
import { DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/Indicator/constants";
import { stateReducer } from "@lichtblick/suite-base/panels/shared/gaugeAndIndicatorStateReducer";
import { GaugeAndIndicatorState } from "@lichtblick/suite-base/panels/shared/types";

import { getMatchingRule } from "./getMatchingRule";
import { settingsActionReducer, useSettingsTree } from "./settings";
import { IndicatorConfig, IndicatorProps, RawValueIndicator } from "./types";

export function Indicator({ context }: IndicatorProps): React.JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CONFIG,
    ...(context.initialState as Partial<IndicatorConfig>),
  }));

  const { style, rules, fallbackColor, fallbackLabel } = config;

  const [state, dispatch] = useReducer(
    stateReducer,
    config,
    ({ path: statePath }): GaugeAndIndicatorState => ({
      globalVariables: undefined,
      error: undefined,
      latestMatchingQueriedData: undefined,
      latestMessage: undefined,
      parsedPath: parseMessagePath(statePath),
      path: statePath,
      pathParseError: undefined,
    }),
  );

  const { error, latestMatchingQueriedData, parsedPath, pathParseError } = state;

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

      if (renderState.variables) {
        dispatch({
          type: "updateGlobalVariables",
          globalVariables: Object.fromEntries(renderState.variables) as GlobalVariables,
        });
      }

      if (renderState.didSeek === true) {
        dispatch({ type: "seek" });
      }

      if (renderState.currentFrame) {
        dispatch({ type: "frame", messages: renderState.currentFrame });
      }
    };
    context.watch("currentFrame");
    context.watch("didSeek");
    context.watch("variables");

    return () => {
      context.onRender = undefined;
    };
  }, [context, dispatch]);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config, pathParseError, error?.message);
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  useEffect(() => {
    if (parsedPath?.topicName != undefined) {
      context.subscribe([{ topic: parsedPath.topicName, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, parsedPath?.topicName]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  const rawValue = useMemo(() => {
    return ["boolean", "number", "bigint", "string"].includes(typeof latestMatchingQueriedData)
      ? latestMatchingQueriedData
      : undefined;
  }, [latestMatchingQueriedData]);

  const matchingRule = useMemo(
    () => getMatchingRule(rawValue as RawValueIndicator, rules),
    [rawValue, rules],
  );

  const bulbColor = matchingRule?.color ?? fallbackColor;
  const {
    classes,
    theme: {
      palette: { augmentColor },
    },
  } = useStyles({ style, backgroundColor: bulbColor });

  const label = matchingRule?.label ?? fallbackLabel;
  const textColor = useMemo(() => {
    return style === "background"
      ? augmentColor({ color: { main: bulbColor } }).contrastText
      : bulbColor;
  }, [style, bulbColor, augmentColor]);

  return (
    <Stack fullHeight>
      <Stack className={classes.indicatorStack}>
        {style === "bulb" && <Bulb label={label} bulbColor={bulbColor} />}
        {style === "background" && <Background label={label} textColor={textColor} />}
      </Stack>
    </Stack>
  );
}

const Bulb = memo(({ label, bulbColor }: { label: string; bulbColor: string }) => {
  const { classes } = useStyles({ backgroundColor: bulbColor });

  return (
    <Stack className={classes.stack}>
      <div className={classes.bulb} data-testid="bulb-indicator" />
      <Typography className={classes.typography}>{label}</Typography>
    </Stack>
  );
});
Bulb.displayName = "Bulb";

const Background = memo(({ label, textColor }: { label: string; textColor: string }) => {
  const { classes } = useStyles({});

  return (
    <Stack className={classes.stack} testId="background-indicator">
      <Typography className={classes.typography} color={textColor}>
        {label}
      </Typography>
    </Stack>
  );
});
Background.displayName = "Background";
