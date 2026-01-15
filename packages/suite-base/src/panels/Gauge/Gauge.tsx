// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useLayoutEffect, useReducer, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { parseMessagePath } from "@lichtblick/message-path";
import { SettingsTreeAction } from "@lichtblick/suite";
import { useStyles } from "@lichtblick/suite-base/panels/Gauge/Gauge.style";
import { buildConicGradient } from "@lichtblick/suite-base/panels/Gauge/buildConicGradient";
import { DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/Gauge/constants";
import { stateReducer } from "@lichtblick/suite-base/panels/shared/gaugeAndIndicatorStateReducer";
import { GaugeAndIndicatorState } from "@lichtblick/suite-base/panels/shared/types";

import { settingsActionReducer } from "./settingsActionReducer";
import { GaugeConfig, GaugeProps } from "./types";
import { useSettingsTree } from "./useSettingsTree";

export function Gauge({ context }: GaugeProps): React.JSX.Element {
  const { classes } = useStyles();
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CONFIG,
    ...(context.initialState as Partial<GaugeConfig>),
  }));

  const [state, dispatch] = useReducer(
    stateReducer,
    config,
    ({ path }): GaugeAndIndicatorState => ({
      globalVariables: undefined,
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
      setConfig((prevConfig) => settingsActionReducer({ prevConfig, action }));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree({
    config,
    pathParseError: state.pathParseError,
    error: state.error?.message,
  });
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
    typeof state.latestMatchingQueriedData === "number" ||
    typeof state.latestMatchingQueriedData === "string"
      ? Number(state.latestMatchingQueriedData)
      : NaN;

  const { minValue, maxValue } = config;
  const scaledValue =
    (Math.max(minValue, Math.min(rawValue, maxValue)) - minValue) / (maxValue - minValue);
  const outOfBounds = rawValue < minValue || rawValue > maxValue;

  const padding = 0.1;
  const centerX = 0.5 + padding;
  const centerY = 0.5 + padding;
  const gaugeAngle = -Math.PI / 8;
  const radius = 0.5;
  const innerRadius = 0.4;
  const width = 1 + 2 * padding;
  const height =
    Math.max(
      centerY - radius * Math.sin(gaugeAngle),
      centerY - innerRadius * Math.sin(gaugeAngle),
    ) + padding;
  const needleThickness = 8;
  const needleExtraLength = 0.05;
  const [clipPathId] = useState(() => `gauge-clip-path-${uuidv4()}`);
  return (
    <div className={classes.root}>
      <div className={classes.gaugeContainer}>
        <div className={classes.gaugeWrapper} style={{ aspectRatio: `${width} / ${height}` }}>
          <div
            className={classes.conicGradient}
            style={{
              background: buildConicGradient({ config, width, height, gaugeAngle }),
              clipPath: `url(#${clipPathId})`,
              opacity: state.latestMatchingQueriedData == undefined ? 0.5 : 1,
            }}
          />
          <div
            className={classes.needle}
            style={{
              backgroundColor: outOfBounds ? "orange" : "white",
              borderRadius: needleThickness / 2,
              bottom: `${100 * (1 - centerY / height)}%`,
              display: Number.isFinite(scaledValue) ? "block" : "none",
              height: `${(100 * (radius + needleExtraLength)) / height}%`,
              transform: [
                `scaleZ(1)`,
                `rotate(${
                  -Math.PI / 2 + gaugeAngle + scaledValue * 2 * (Math.PI / 2 - gaugeAngle)
                }rad)`,
                `translateX(${-needleThickness / 2}px)`,
                `translateY(${needleThickness / 2}px)`,
              ].join(" "),
              width: needleThickness,
            }}
          />
        </div>
        <svg style={{ position: "absolute" }}>
          <clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
            <path
              transform={`scale(${1 / width}, ${1 / height})`}
              d={[
                `M ${centerX - radius * Math.cos(gaugeAngle)},${
                  centerY - radius * Math.sin(gaugeAngle)
                }`,
                `A 0.5,0.5 0 ${gaugeAngle < 0 ? 1 : 0} 1 ${
                  centerX + radius * Math.cos(gaugeAngle)
                },${centerY - radius * Math.sin(gaugeAngle)}`,
                `L ${centerX + innerRadius * Math.cos(gaugeAngle)},${
                  centerY - innerRadius * Math.sin(gaugeAngle)
                }`,
                `A ${innerRadius},${innerRadius} 0 ${gaugeAngle < 0 ? 1 : 0} 0 ${
                  centerX - innerRadius * Math.cos(gaugeAngle)
                },${centerY - innerRadius * Math.sin(gaugeAngle)}`,
                `Z`,
              ].join(" ")}
            />
          </clipPath>
        </svg>
      </div>
    </div>
  );
}
