// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as _ from "lodash-es";
import { Typography } from "@mui/material";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { DeepPartial } from "ts-essentials";

import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import { SettingsTreeAction, Topic } from "@lichtblick/suite";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import Stack from "@lichtblick/suite-base/components/Stack";
import DirectionalPad from "@lichtblick/suite-base/panels/Teleop/DirectionalPad";
import { buildSettingsTreeTeleop } from "@lichtblick/suite-base/panels/Teleop/buildSettingsTree";
import {
  TeleopConfig,
  DirectionalPadAction,
  TeleopPanelProps,
} from "@lichtblick/suite-base/panels/Teleop/types";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

function TeleopPanel(props: Readonly<TeleopPanelProps>): React.JSX.Element {
  const { context } = props;
  const { saveState } = context;

  const [currentAction, setCurrentAction] = useState<DirectionalPadAction | undefined>();
  const [topics, setTopics] = useState<readonly Topic[]>([]);
  const [currentVelocities, setCurrentVelocities] = useState<{
    linearX: number;
    linearY: number;
    angularZ: number;
  }>({ linearX: 0, linearY: 0, angularZ: 0 });

  // resolve an initial config which may have some missing fields into a full config
  const [config, setConfig] = useState<TeleopConfig>(() => {
    const partialConfig = context.initialState as DeepPartial<TeleopConfig>;

    const {
      topic = "/cmd_vel_teleop",
      publishRate = 20,
      upButton: { field: upField = "linear-x", value: upValue = 0.1 } = {},
      downButton: { field: downField = "linear-x", value: downValue = -0.1 } = {},
      leftButton: { field: leftField = "linear-y", value: leftValue = 0.1 } = {},
      rightButton: { field: rightField = "linear-y", value: rightValue = -0.1 } = {},
      rotateLeftButton: { field: rotateLeftField = "angular-z", value: rotateLeftValue = 0.1 } = {},
      rotateRightButton: { field: rotateRightField = "angular-z", value: rotateRightValue = -0.1 } = {},
    } = partialConfig;

    return {
      topic,
      publishRate,
      upButton: { field: upField, value: upValue },
      downButton: { field: downField, value: downValue },
      leftButton: { field: leftField, value: leftValue },
      rightButton: { field: rightField, value: rightValue },
      rotateLeftButton: { field: rotateLeftField, value: rotateLeftValue },
      rotateRightButton: { field: rotateRightField, value: rotateRightValue },
    };
  });

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action !== "update") {
      return;
    }

    setConfig((previous) => {
      const newConfig = { ...previous };
      _.set(newConfig, action.payload.path.slice(1), action.payload.value);
      return newConfig;
    });
  }, []);

  // setup context render handler and render done handling
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  useLayoutEffect(() => {
    context.watch("topics");
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setTopics(renderState.topics ?? []);
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  useEffect(() => {
    const tree = buildSettingsTreeTeleop(config, topics);
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: tree,
    });
    saveState(config);
  }, [config, context, saveState, settingsActionHandler, topics]);

  // advertise topic
  const { topic: currentTopic } = config;
  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    context.advertise?.(currentTopic, "geometry_msgs/Twist", {
      datatypes: new Map([
        ["geometry_msgs/Vector3", ros1["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", ros1["geometry_msgs/Twist"]],
      ]),
    });

    return () => {
      context.unadvertise?.(currentTopic);
    };
  }, [context, currentTopic]);

  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    // Reset velocities when no action is active
    if (currentAction == undefined) {
      setCurrentVelocities({ linearX: 0, linearY: 0, angularZ: 0 });
      return;
    }

    // Handle STOP action - publish zero velocity immediately
    if (currentAction === DirectionalPadAction.STOP) {
      const stopMessage = {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      };
      setCurrentVelocities({ linearX: 0, linearY: 0, angularZ: 0 });
      context.publish?.(currentTopic, stopMessage);
      // Publish stop message a few times to ensure it's received
      const stopInterval = setInterval(() => {
        context.publish?.(currentTopic, stopMessage);
      }, 100);
      const timeoutId = setTimeout(() => {
        clearInterval(stopInterval);
      }, 500);
      return () => {
        clearInterval(stopInterval);
        clearTimeout(timeoutId);
      };
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
      case DirectionalPadAction.ROTATE_LEFT:
        if (config.rotateLeftButton) {
          setFieldValue(config.rotateLeftButton.field, config.rotateLeftButton.value);
        }
        break;
      case DirectionalPadAction.ROTATE_RIGHT:
        if (config.rotateRightButton) {
          setFieldValue(config.rotateRightButton.field, config.rotateRightButton.value);
        }
        break;
      default:
    }

    // Update velocity indicators after message is updated
    setCurrentVelocities({
      linearX: message.linear.x,
      linearY: message.linear.y,
      angularZ: message.angular.z,
    });

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

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack
        fullHeight
        justifyContent="center"
        alignItems="center"
        style={{ padding: "min(5%, 8px)", textAlign: "center", position: "relative" }}
      >
        {!canPublish && <EmptyState>Connect to a data source that supports publishing</EmptyState>}
        {canPublish && !hasTopic && (
          <EmptyState>Select a publish topic in the panel settings</EmptyState>
        )}
        {enabled && (
          <>
            {/* Velocity Indicators */}
            <Stack
              direction="row"
              gap={3}
              style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
              }}
            >
              <Stack alignItems="center" gap={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  X
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color={currentVelocities.linearX !== 0 ? "primary.main" : "text.secondary"}
                >
                  {currentVelocities.linearX.toFixed(2)} m/s
                </Typography>
              </Stack>
              <Stack alignItems="center" gap={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  Y
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color={currentVelocities.linearY !== 0 ? "primary.main" : "text.secondary"}
                >
                  {currentVelocities.linearY.toFixed(2)} m/s
                </Typography>
              </Stack>
              <Stack alignItems="center" gap={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  Yaw
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color={currentVelocities.angularZ !== 0 ? "primary.main" : "text.secondary"}
                >
                  {currentVelocities.angularZ.toFixed(2)} rad/s
                </Typography>
              </Stack>
            </Stack>
            <DirectionalPad onAction={setCurrentAction} disabled={!enabled} />
          </>
        )}
      </Stack>
    </ThemeProvider>
  );
}

export default TeleopPanel;
