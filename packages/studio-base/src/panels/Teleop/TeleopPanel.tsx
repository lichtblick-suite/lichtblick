// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, DialogFooter, PrimaryButton } from "@fluentui/react";
import { Stack, Typography } from "@mui/material";
import { ReactNode, useCallback, useLayoutEffect, useMemo, useState } from "react";

import { definitions as commonDefs } from "@foxglove/rosmsg-msgs-common";
import { PanelExtensionContext, Topic } from "@foxglove/studio";
import HoverableIconButton from "@foxglove/studio-base/components/HoverableIconButton";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { darkFluentTheme, lightFluentTheme } from "@foxglove/studio-base/theme/createFluentTheme";

import DirectionalPad, { DirectionalPadAction } from "./DirectionalPad";
import Settings from "./Settings";
import { Config, DeepPartial } from "./types";

type TeleopPanelProps = {
  context: PanelExtensionContext;
};

function ErrorMessage({
  children,
  message,
}: {
  children?: ReactNode;
  message: string;
}): JSX.Element {
  return (
    <Stack
      alignItems="center"
      direction="column"
      spacing={3}
      style={{ maxWidth: "60ch", textAlign: "center" }}
    >
      <Typography variant="h4">{message}</Typography>
      {children}
    </Stack>
  );
}

function TeleopPanel(props: TeleopPanelProps): JSX.Element {
  const { context } = props;
  const { saveState } = context;

  const [currentAction, setCurrentAction] = useState<DirectionalPadAction | undefined>();

  // resolve an initial config which may have some missing fields into a full config
  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as DeepPartial<Config>;

    const {
      topic,
      publishRate = 1,
      upButton: { field: upField = "linear-x", value: upValue = 1 } = {},
      downButton: { field: downField = "linear-x", value: downValue = -1 } = {},
      leftButton: { field: leftField = "angular-z", value: leftValue = 1 } = {},
      rightButton: { field: rightField = "angular-z", value: rightValue = -1 } = {},
    } = partialConfig;

    return {
      topic,
      publishRate,
      upButton: { field: upField, value: upValue },
      downButton: { field: downField, value: downValue },
      leftButton: { field: leftField, value: leftValue },
      rightButton: { field: rightField, value: rightValue },
    };
  });

  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const onChangeConfig = useCallback(
    (newConfig: Config) => {
      setConfig(newConfig);
      saveState(newConfig);
    },
    [saveState],
  );

  // setup context render handler and render done handling
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  useLayoutEffect(() => {
    context.watch("topics");
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  // advertise topic
  const { topic: currentTopic } = config;
  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    context.advertise?.(currentTopic, "geometry_msgs/Twist", {
      datatypes: new Map([
        ["geometry_msgs/Vector3", commonDefs["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", commonDefs["geometry_msgs/Twist"]],
      ]),
    });

    return () => {
      context.unadvertise?.(currentTopic);
    };
  }, [context, currentTopic]);

  const topicNames = useMemo(() => {
    if (!topics) {
      return [];
    }

    return topics.map((topic) => topic.name);
  }, [topics]);

  useLayoutEffect(() => {
    if (currentAction == undefined || !currentTopic) {
      return;
    }

    const message = {
      linear: {
        x: 0,
        y: 0,
        z: 0,
      },
      angular: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    function setFieldValue(field: string, value: number) {
      switch (field) {
        case "linear-x":
          message.linear.x = value;
          break;
        case "linear-y":
          message.linear.y = value;
          break;
        case "linear-z":
          message.linear.z = value;
          break;
        case "angular-x":
          message.angular.x = value;
          break;
        case "angular-y":
          message.angular.y = value;
          break;
        case "angular-z":
          message.angular.z = value;
          break;
      }
    }

    switch (currentAction) {
      case DirectionalPadAction.UP:
        setFieldValue(config.upButton.field, config.upButton.value);
        break;
      case DirectionalPadAction.DOWN:
        setFieldValue(config.downButton.field, config.downButton.value);
        break;
      case DirectionalPadAction.LEFT:
        setFieldValue(config.leftButton.field, config.leftButton.value);
        break;
      case DirectionalPadAction.RIGHT:
        setFieldValue(config.rightButton.field, config.rightButton.value);
        break;
      default:
    }

    // don't publish if rate is 0 or negative - this is a config error on user's part
    if (config.publishRate <= 0) {
      return;
    }

    const intervalMs = (1000 * 1) / config.publishRate;
    context.publish?.(currentTopic, message);
    const intervalHandle = setInterval(() => {
      context.publish?.(currentTopic, message);
    }, intervalMs);

    return () => {
      clearInterval(intervalHandle);
    };
  }, [context, config, currentTopic, currentAction]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  const canPublish = context.publish != undefined && config.publishRate > 0;
  const hasTopic = Boolean(currentTopic);
  const enabled = canPublish && hasTopic;
  const theme = colorScheme === "dark" ? darkFluentTheme : lightFluentTheme;

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack height="100%" justifyContent="center" alignItems="center" padding="min(5%, 8px)">
        {!canPublish && (
          <ErrorMessage message="Please connect to a datasource that supports publishing in order to use this panel." />
        )}
        {canPublish && !hasTopic && (
          <ErrorMessage message="Please select a topic in the panel settings in order to use this panel.">
            <PrimaryButton onClick={() => setShowSettings(true)}>Open Panel Settings</PrimaryButton>
          </ErrorMessage>
        )}
        {enabled && <DirectionalPad onAction={setCurrentAction} disabled={!enabled} />}
      </Stack>
      <Stack position="absolute" top={0} left={0} margin={1}>
        <HoverableIconButton
          onClick={() => setShowSettings(true)}
          iconProps={{
            iconName: "Settings",
            iconNameActive: "SettingsFilled",
          }}
          styles={{
            root: {
              backgroundColor: theme.semanticColors.buttonBackgroundHovered,
              "&:hover": { backgroundColor: theme.semanticColors.buttonBackgroundPressed },
            },
            icon: { height: 20 },
          }}
        >
          Panel settings
        </HoverableIconButton>
      </Stack>
      <Dialog
        dialogContentProps={{ title: "Teleop panel settings", showCloseButton: true }}
        hidden={!showSettings}
        onDismiss={() => setShowSettings(false)}
        maxWidth={480}
        minWidth={480}
      >
        <Settings config={config} onConfigChange={onChangeConfig} topics={topicNames} />
        <DialogFooter>
          <PrimaryButton onClick={() => setShowSettings(false)}>Done</PrimaryButton>
        </DialogFooter>
      </Dialog>
    </ThemeProvider>
  );
}

export default TeleopPanel;
