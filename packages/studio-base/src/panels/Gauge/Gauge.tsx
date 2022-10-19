// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { last } from "lodash";
import { useCallback, useEffect, useLayoutEffect, useReducer, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { RosPath } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { turboColorString } from "@foxglove/studio-base/util/colorUtils";

import { settingsActionReducer, useSettingsTree } from "./settings";
import type { Config } from "./types";

type Props = {
  context: PanelExtensionContext;
};

const defaultConfig: Config = {
  path: "",
  minValue: 0,
  maxValue: 1,
  colorMap: "red-yellow-green",
  colorMode: "colormap",
  gradient: ["#0000ff", "#ff00ff"],
  reverse: false,
};

type State = {
  path: string;
  parsedPath: RosPath | undefined;
  latestMessage: MessageEvent<unknown> | undefined;
  latestMatchingQueriedData: unknown | undefined;
  error: Error | undefined;
  pathParseError: string | undefined;
};

type Action =
  | { type: "frame"; messages: readonly MessageEvent<unknown>[] }
  | { type: "path"; path: string }
  | { type: "seek" };

function getSingleDataItem(results: unknown[]) {
  if (results.length <= 1) {
    return results[0];
  }
  throw new Error("Message path produced multiple results");
}

function reducer(state: State, action: Action): State {
  try {
    switch (action.type) {
      case "frame": {
        if (state.pathParseError != undefined) {
          return { ...state, latestMessage: last(action.messages), error: undefined };
        }
        let latestMatchingQueriedData = state.latestMatchingQueriedData;
        let latestMessage = state.latestMessage;
        if (state.parsedPath) {
          for (const message of action.messages) {
            if (message.topic !== state.parsedPath.topicName) {
              continue;
            }
            const data = getSingleDataItem(
              simpleGetMessagePathDataItems(message, state.parsedPath),
            );
            if (data != undefined) {
              latestMatchingQueriedData = data;
              latestMessage = message;
            }
          }
        }
        return { ...state, latestMessage, latestMatchingQueriedData, error: undefined };
      }
      case "path": {
        const newPath = parseRosPath(action.path);
        let pathParseError: string | undefined;
        if (
          newPath?.messagePath.some(
            (part) =>
              (part.type === "filter" && typeof part.value === "object") ||
              (part.type === "slice" &&
                (typeof part.start === "object" || typeof part.end === "object")),
          ) === true
        ) {
          pathParseError = "Message paths using variables are not currently supported";
        }
        let latestMatchingQueriedData: unknown | undefined;
        let error: Error | undefined;
        try {
          latestMatchingQueriedData =
            newPath && pathParseError == undefined && state.latestMessage
              ? getSingleDataItem(simpleGetMessagePathDataItems(state.latestMessage, newPath))
              : undefined;
        } catch (err) {
          error = err;
        }
        return {
          ...state,
          path: action.path,
          parsedPath: newPath,
          latestMatchingQueriedData,
          error,
          pathParseError,
        };
      }
      case "seek":
        return {
          ...state,
          latestMessage: undefined,
          latestMatchingQueriedData: undefined,
          error: undefined,
        };
    }
  } catch (error) {
    return { ...state, latestMatchingQueriedData: undefined, error };
  }
}

function getConicGradient(config: Config, width: number, height: number, gaugeAngle: number) {
  let colorStops: { color: string; location: number }[];
  switch (config.colorMode) {
    case "colormap":
      switch (config.colorMap) {
        case "red-yellow-green":
          colorStops = [
            { color: "#f00", location: 0 },
            { color: "#ff0", location: 0.5 },
            { color: "#0c0", location: 1 },
          ];
          break;
        case "rainbow":
          colorStops = [
            { color: "#f0f", location: 0 },
            { color: "#00f", location: 1 / 5 },
            { color: "#0ff", location: 2 / 5 },
            { color: "#0f0", location: 3 / 5 },
            { color: "#ff0", location: 4 / 5 },
            { color: "#f00", location: 5 / 5 },
          ];
          break;
        case "turbo": {
          const numStops = 20;
          colorStops = new Array(numStops).fill(undefined).map((_, i) => ({
            color: turboColorString(i / (numStops - 1)),
            location: i / (numStops - 1),
          }));
          break;
        }
      }
      break;
    case "gradient":
      colorStops = [
        { color: config.gradient[0], location: 0 },
        { color: config.gradient[1], location: 1 },
      ];
      break;
  }
  if (config.reverse) {
    colorStops = colorStops
      .map((stop) => ({ color: stop.color, location: 1 - stop.location }))
      .reverse();
  }

  return `conic-gradient(from ${-Math.PI / 2 + gaugeAngle}rad at 50% ${
    100 * (width / 2 / height)
  }%, ${colorStops
    .map((stop) => `${stop.color} ${stop.location * 2 * (Math.PI / 2 - gaugeAngle)}rad`)
    .join(",")}, ${colorStops[0]!.color})`;
}

export function Gauge({ context }: Props): JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const [config, setConfig] = useState(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const [state, dispatch] = useReducer(
    reducer,
    config,
    ({ path }): State => ({
      path,
      parsedPath: parseRosPath(path),
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
    (action: SettingsTreeAction) =>
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action)),
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
      context.subscribe([state.parsedPath.topicName]);
    }
    return () => context.unsubscribeAll();
  }, [context, state.parsedPath?.topicName]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  const rawValue =
    typeof state.latestMatchingQueriedData === "number" ? state.latestMatchingQueriedData : NaN;

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
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",
        alignItems: "center",
        overflow: "hidden",
        padding: 8,
      }}
    >
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${width} / ${height}`,
            margin: "0 auto",
            transform: "scale(1)", // Work around a Safari bug: https://bugs.webkit.org/show_bug.cgi?id=231849
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: getConicGradient(config, width, height, gaugeAngle),
              clipPath: `url(#${clipPathId})`,
              opacity: state.latestMatchingQueriedData == undefined ? 0.5 : 1,
            }}
          />
          <div
            style={{
              backgroundColor: outOfBounds ? "orange" : "white",
              width: needleThickness,
              height: `${(100 * (radius + needleExtraLength)) / height}%`,
              border: "2px solid black",
              borderRadius: needleThickness / 2,
              position: "absolute",
              bottom: `${100 * (1 - centerY / height)}%`,
              left: "50%",
              transformOrigin: "bottom left",
              margin: "0 auto",
              transform: [
                `scaleZ(1)`,
                `rotate(${
                  -Math.PI / 2 + gaugeAngle + scaledValue * 2 * (Math.PI / 2 - gaugeAngle)
                }rad)`,
                `translateX(${-needleThickness / 2}px)`,
                `translateY(${needleThickness / 2}px)`,
              ].join(" "),
              display: Number.isFinite(scaledValue) ? "block" : "none",
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
