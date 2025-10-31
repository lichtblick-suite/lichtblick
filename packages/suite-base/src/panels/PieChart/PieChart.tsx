// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2024-2025 Yukihiro Saito <yukky.saito@gmail.com>
// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useLayoutEffect, useReducer, useState, useMemo } from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { parseMessagePath } from "@lichtblick/message-path";
import { PanelExtensionContext, SettingsTreeAction } from "@lichtblick/suite";
import { useLegendCount } from "@lichtblick/suite-base/components/SettingsTreeEditor/inputs/useLegendCount";

import { useStyles, tooltipStyle } from "./PieChart.style";
import { DEFAULT_CONFIG } from "./constants";
import type { PieChartConfig, PieChartState } from "./types";
import { useChartData } from "./useChartData";
import { useSettingsTree } from "./useSettingsTree";
import { settingsActionReducer } from "./utils/settingsActionReducer";
import { stateReducer } from "./utils/stateReducer";

type PieChartProps = {
  context: PanelExtensionContext;
};

export function formatTooltip(value: number, name: string): [string, string] {
  const formattedValue = typeof value === "number" ? value.toFixed(2) : value;
  return [`${formattedValue}%`, name];
}

export function PieChart({ context }: PieChartProps): React.JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const { classes } = useStyles();
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const { legendCount } = useLegendCount();

  const [config, setConfig] = useState<PieChartConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...(context.initialState as Partial<PieChartConfig>),
  }));

  const [state, dispatch] = useReducer(
    stateReducer,
    config,
    ({ path }): PieChartState => ({
      path,
      parsedPath: parseMessagePath(path),
      latestMessage: undefined,
      latestMatchingQueriedData: undefined,
      pathParseError: undefined,
      error: undefined,
    }),
  );

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
  }, []);

  const settingsTree = useSettingsTree({
    config,
    pathParseError: state.pathParseError,
    error: state.error?.message,
    legendCount,
  });

  // Extract raw values from queried message data
  const rawValue = useMemo(
    () =>
      state.latestMatchingQueriedData instanceof Float32Array
        ? state.latestMatchingQueriedData
        : new Float32Array(),
    [state.latestMatchingQueriedData],
  );

  // Normalize values into percentage format from useChartData
  const data = useChartData(rawValue, config);

  // Dispatch path change on config.path update
  useLayoutEffect(() => {
    dispatch({ type: "path", path: config.path });
  }, [config.path]);

  // Save panel state and title on config update
  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.path === "" ? undefined : config.path);
  }, [config, context]);

  // Register frame/seek render handler
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

  // Update panel settings editor with latest tree and handler
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  // Subscribe/unsubscribe to topic from parsed path
  useEffect(() => {
    if (state.parsedPath?.topicName != undefined) {
      context.subscribe([{ topic: state.parsedPath.topicName, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, state.parsedPath?.topicName]);

  // Call renderDone after render
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <div className={classes.root}>
      <h1 className={classes.title}>{config.title} </h1>
      {rawValue.length === 0 ? (
        <div>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <RechartsPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              label={({ index }) => {
                const value = rawValue[index];
                return value?.toString ? value.toFixed(2) : "";
              }}
              fill="#8884d8"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="80%"
              animationBegin={500}
              animationDuration={1500}
              animationEasing="ease-in-out"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={formatTooltip} />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
