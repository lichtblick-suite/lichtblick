// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Palette, TextField, Tooltip, Typography, inputBaseClasses } from "@mui/material";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Log from "@foxglove/log";
import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import { Config } from "@foxglove/studio-base/panels/CallService/types";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { defaultConfig, settingsActionReducer, useSettingsTree } from "./settings";

const log = Log.getLogger(__dirname);

type Props = {
  context: PanelExtensionContext;
};

type State = {
  status: "requesting" | "error" | "success";
  value: string;
};

const useStyles = makeStyles<{ buttonColor?: string }>()((theme, { buttonColor }) => {
  const augmentedButtonColor = buttonColor
    ? theme.palette.augmentColor({
        color: { main: buttonColor },
      })
    : undefined;

  return {
    button: {
      backgroundColor: augmentedButtonColor?.main,
      color: augmentedButtonColor?.contrastText,

      "&:hover": {
        backgroundColor: augmentedButtonColor?.dark,
      },
    },
    textarea: {
      height: "100%",

      [`.${inputBaseClasses.root}`]: {
        backgroundColor: theme.palette.background.paper,
        height: "100%",
        overflow: "hidden",
        padding: theme.spacing(1, 0.5),
        textAlign: "left",
        width: "100%",

        [`.${inputBaseClasses.input}`]: {
          height: "100% !important",
          lineHeight: 1.4,
          fontFamily: theme.typography.fontMonospace,
          overflow: "auto !important",
          resize: "none",
        },
      },
    },
  };
});

function parseInput(value: string): { error?: string; parsedObject?: unknown } {
  let parsedObject;
  let error = undefined;
  try {
    const parsedAny: unknown = JSON.parse(value);
    if (Array.isArray(parsedAny)) {
      error = "Request content must be an object, not an array";
    } else if (parsedAny == undefined) {
      error = "Request content must be an object, not null";
    } else if (typeof parsedAny !== "object") {
      error = `Request content must be an object, not ‘${typeof parsedAny}’`;
    } else {
      parsedObject = parsedAny;
    }
  } catch (e) {
    error = value.length !== 0 ? e.message : "Enter valid request content as JSON";
  }
  return { error, parsedObject };
}

// Wrapper component with ThemeProvider so useStyles in the panel receives the right theme.
export function CallService({ context }: Props): JSX.Element {
  const [colorScheme, setColorScheme] = useState<Palette["mode"]>("light");

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <CallServiceContent context={context} setColorScheme={setColorScheme} />
    </ThemeProvider>
  );
}

function CallServiceContent(
  props: Props & { setColorScheme: Dispatch<SetStateAction<Palette["mode"]>> },
): JSX.Element {
  const { context, setColorScheme } = props;

  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [state, setState] = useState<State | undefined>();
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));
  const { classes } = useStyles({ buttonColor: config.buttonColor });

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(
      config.serviceName ? `Call service ${config.serviceName}` : undefined,
    );
  }, [config, context]);

  useEffect(() => {
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setColorScheme(renderState.colorScheme ?? "light");
    };

    return () => {
      context.onRender = undefined;
    };
  }, [context, setColorScheme]);

  const { error: requestParseError, parsedObject } = useMemo(
    () => parseInput(config.requestPayload ?? ""),
    [config.requestPayload],
  );

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config);
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  const statusMessage = useMemo(() => {
    if (context.callService == undefined) {
      return "Connect to a data source that supports calling services";
    }
    if (!config.serviceName) {
      return "Configure a service in the panel settings";
    }
    return undefined;
  }, [context, config.serviceName]);

  const canCallService = Boolean(
    context.callService != undefined &&
      config.requestPayload &&
      config.serviceName &&
      parsedObject != undefined &&
      state?.status !== "requesting",
  );

  const callServiceClicked = useCallback(async () => {
    if (!context.callService) {
      setState({ status: "error", value: "The data source does not allow calling services" });
      return;
    }

    try {
      setState({ status: "requesting", value: `Calling ${config.serviceName}...` });
      const response = await context.callService(
        config.serviceName!,
        JSON.parse(config.requestPayload!),
      );
      setState({
        status: "success",
        value:
          JSON.stringify(
            response,
            // handle stringify BigInt correctly
            (_key, value) => (typeof value === "bigint" ? value.toString() : value),
            2,
          ) ?? "",
      });
    } catch (err) {
      setState({ status: "error", value: (err as Error).message });
      log.error(err);
    }
  }, [context, config.serviceName, config.requestPayload]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <Stack flex="auto" gap={1} padding={1.5} position="relative" fullHeight>
      <Stack gap={1} flexGrow="1" direction={config.layout === "horizontal" ? "row" : "column"}>
        <Stack flexGrow="1">
          <Typography variant="caption" noWrap>
            Request
          </Typography>
          <TextField
            variant="outlined"
            className={classes.textarea}
            multiline
            size="small"
            placeholder="Enter service request as JSON"
            value={config.requestPayload}
            onChange={(event) => {
              setConfig({ ...config, requestPayload: event.target.value });
            }}
            error={requestParseError != undefined}
          />
          {requestParseError && (
            <Typography variant="caption" noWrap color={requestParseError ? "error" : undefined}>
              {requestParseError}
            </Typography>
          )}
        </Stack>
        <Stack flexGrow="1">
          <Typography variant="caption" noWrap>
            Response
          </Typography>
          <TextField
            variant="outlined"
            className={classes.textarea}
            multiline
            size="small"
            placeholder="Response"
            value={state?.value}
            error={state?.status === "error"}
          />
        </Stack>
      </Stack>
      <Stack
        direction="row"
        justifyContent="flex-end"
        alignItems="center"
        overflow="hidden"
        flexGrow={0}
        gap={1.5}
      >
        {statusMessage && (
          <Typography variant="caption" noWrap>
            {statusMessage}
          </Typography>
        )}
        <Tooltip title={config.buttonTooltip}>
          <span>
            <Button
              className={classes.button}
              variant="contained"
              disabled={!canCallService}
              onClick={callServiceClicked}
              data-testid="call-service-button"
            >
              {config.buttonText ? config.buttonText : `Call service ${config.serviceName ?? ""}`}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
