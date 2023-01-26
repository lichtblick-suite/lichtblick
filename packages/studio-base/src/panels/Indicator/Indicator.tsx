// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography, useTheme } from "@mui/material";
import { last } from "lodash";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { withStyles } from "tss-react/mui";

import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { RosPath } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import Stack from "@foxglove/studio-base/components/Stack";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

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

const IndicatorBulb = withStyles("div", {
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

export function Indicator({ context }: Props): JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const {
    palette: { augmentColor },
  } = useTheme();

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
            <IndicatorBulb style={{ backgroundColor: matchingRule?.color ?? fallbackColor }} />
          )}
          <Typography
            color={
              style === "background"
                ? augmentColor({
                    color: { main: matchingRule?.color ?? fallbackColor },
                  }).contrastText
                : matchingRule?.color ?? fallbackColor
            }
            fontFamily={fonts.MONOSPACE}
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
