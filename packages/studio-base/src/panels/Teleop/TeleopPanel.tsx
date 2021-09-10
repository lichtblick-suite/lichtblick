// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, DialogFooter, PrimaryButton, Stack, useTheme } from "@fluentui/react";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";

import { definitions as commonDefs } from "@foxglove/rosmsg-msgs-common";
import { PanelExtensionContext, Topic } from "@foxglove/studio";
import HoverableIconButton from "@foxglove/studio-base/components/HoverableIconButton";

import DirectionalPad, { DirectionalPadAction } from "./DirectionalPad";
import Settings from "./Settings";
import { Config, DeepPartial } from "./types";

type TeleopPanelProps = {
  context: PanelExtensionContext;
};

function TeleopPanel(props: TeleopPanelProps): JSX.Element {
  const { context } = props;
  const { saveState } = context;
  const theme = useTheme();

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
  useLayoutEffect(() => {
    context.watch("topics");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      setTopics(renderState.topics);
    };
  }, [context]);

  // advertise topic
  const { topic: currentTopic } = config;
  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    context.advertise(currentTopic, "geometry_msgs/Twist", {
      datatypes: new Map([
        ["geometry_msgs/Vector3", commonDefs["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", commonDefs["geometry_msgs/Twist"]],
      ]),
    });

    return () => {
      context.unadvertise(currentTopic);
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
    context.publish(currentTopic, message);
    const intervalHandle = setInterval(() => {
      context.publish(currentTopic, message);
    }, intervalMs);

    return () => {
      clearInterval(intervalHandle);
    };
  }, [context, config, currentTopic, currentAction]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <>
      <Stack
        verticalFill
        verticalAlign="center"
        horizontalAlign="center"
        tokens={{ padding: `min(5%, ${theme.spacing.s1})` }}
      >
        <DirectionalPad onAction={setCurrentAction} />
      </Stack>
      <Stack styles={{ root: { position: "absolute", top: 0, left: 0, margin: theme.spacing.s1 } }}>
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
    </>
  );
}

export default TeleopPanel;
