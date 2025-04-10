// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable no-restricted-syntax */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable import/order */
import { useState, useRef, useEffect, useCallback } from "react";
import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";

import usePublisher from "@lichtblick/suite-base/hooks/usePublisher";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { useCodeServerSettings } from "./settings";
import { Joysetting } from "./types";
import "./Joystick.css";
import { Button } from "@mui/material";

type Props = {
  config: Joysetting;
  saveConfig: SaveConfig<Joysetting>;
};

interface Position {
  x: number;
  y: number;
}

function Joystick(props: Props): React.JSX.Element {
  const { config, saveConfig } = props;
  const { topics, datatypes } = useDataSourceInfo();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [viewPosition, setVPosition] = useState<Position>({ x: 0, y: 0 });
  const [leaveMode, setLeaveMode] = useState<boolean>(config.mode);
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalEmergencyRef = useRef<NodeJS.Timeout | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);

  // Update leaveMode when config changes
  useEffect(() => {
    setLeaveMode(config.mode);
  }, [config]);

  useCodeServerSettings(config, saveConfig, topics);

  const cmdPublish = usePublisher({
    name: "Publish",
    topic: config.topic,
    schemaName: "geometry_msgs/msg/Twist",
    datatypes,
  });

  useEffect(() => {
    if (isEmergency) {
      intervalEmergencyRef.current = setInterval(() => {
        cmdPublish({
          linear: { x: 0, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: 0 },
        } as Record<string, unknown>);
      }, 10); // 100ms = 10Hz
    } else {
      if (intervalEmergencyRef.current) {
        clearInterval(intervalEmergencyRef.current);
      }
    }

    // 设置定时器，以10Hz的频率调用cmdPublish

    // 清除定时器，防止内存泄漏
    return () => {
      if (intervalEmergencyRef.current) {
        clearInterval(intervalEmergencyRef.current);
      }
    };
  }, [isEmergency, cmdPublish]);

  // Handle joystick movement
  const handleMove = useCallback(
    (x: number, y: number) => {
      // Apply deadzone
      const deadzone = 0.1; // Adjust as needed
      let newX = x;
      let newY = y;

      if (Math.abs(newX) < deadzone) {
        newX = 0;
      }
      if (Math.abs(newY) < deadzone) {
        newY = 0;
      }

      setVPosition({ x: newX, y: newY });
      newX = Math.max(-1 * config.angle, Math.min(config.angle, newX));
      newY = Math.max(-1 * config.vel, Math.min(config.vel, newY));
      setPosition({ x: newX, y: newY });
    },
    [config.angle, config.vel],
  );

  // Publish cmd_vel message continuously
  const publishCmdVel = useCallback(() => {
    if (position.x !== 0 || position.y !== 0) {
      try {
        cmdPublish({
          linear: { x: position.y * -1, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: position.x * -1 },
        } as Record<string, unknown>);
      } catch (error) {
        console.error("Failed to publish cmd_vel:", error);
      }
    }
  }, [position.x, position.y, cmdPublish]);

  // Start or stop the interval based on input values
  useEffect(() => {
    if (position.x !== 0 || position.y !== 0) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(publishCmdVel, 100); // Publish every 100ms
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [position.x, position.y, publishCmdVel]);

  // Handle mouse events
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && joystickRef.current) {
        const rect = joystickRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left - rect.width / 2;
        const offsetY = e.clientY - rect.top - rect.height / 2;
        const distance = Math.min(rect.width / 2, rect.height / 2);
        const angle = Math.atan2(offsetY, offsetX);

        const x = Math.cos(angle) * (Math.min(Math.abs(offsetX), distance) / distance);
        const y = Math.sin(angle) * (Math.min(Math.abs(offsetY), distance) / distance);
        handleMove(x, y);
      }
    },
    [isDragging, handleMove],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    setVPosition({ x: 0, y: 0 });
  }, []);

  // Handle touch events
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1 && joystickRef.current) {
        const touch = e.touches[0];
        const rect = joystickRef.current.getBoundingClientRect();
        if (touch) {
          const offsetX = touch.clientX - rect.left - rect.width / 2;
          const offsetY = touch.clientY - rect.top - rect.height / 2;
          const distance = Math.min(rect.width / 2, rect.height / 2);
          const angle = Math.atan2(offsetY, offsetX);

          const x = Math.cos(angle) * (Math.min(Math.abs(offsetX), distance) / distance);
          const y = Math.sin(angle) * (Math.min(Math.abs(offsetY), distance) / distance);
          handleMove(x, y);
        }
      }
    },
    [isDragging, handleMove],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    setVPosition({ x: 0, y: 0 });
  }, []);

  // Add event listeners for mouse and touch
  useEffect(() => {
    const joystickElement = joystickRef.current;
    if (!joystickElement) {
      return;
    }

    joystickElement.addEventListener("mousemove", handleMouseMove);
    joystickElement.addEventListener("mouseup", handleMouseUp);
    joystickElement.addEventListener("touchmove", handleTouchMove);
    joystickElement.addEventListener("touchend", handleTouchEnd);

    return () => {
      joystickElement.removeEventListener("mousemove", handleMouseMove);
      joystickElement.removeEventListener("mouseup", handleMouseUp);
      joystickElement.removeEventListener("touchmove", handleTouchMove);
      joystickElement.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Xbox 360 Controller Support
  const pollGamepad = useCallback(() => {
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[0]; // Use the first connected gamepad

    if (gamepad && gamepad.axes.length >= 2) {
      // Xbox 360 Left Stick: Axes 0 (horizontal) and 1 (vertical)
      const x = gamepad.axes[0];
      const y = gamepad.axes[1];
      if (x != undefined && y != undefined) {
        handleMove(x, y);
      }
      // Invert Y-axis to match joystick behavior
    }

    animationFrameRef.current = requestAnimationFrame(pollGamepad);
  }, [handleMove]);

  const handleGamepadConnected = useCallback(
    (e: GamepadEvent) => {
      console.log("Gamepad connected:", e.gamepad);
      setIsGamepadConnected(true);
      pollGamepad();
    },
    [pollGamepad],
  );

  const handleGamepadDisconnected = useCallback((e: GamepadEvent) => {
    console.log("Gamepad disconnected:", e.gamepad);
    setIsGamepadConnected(false);
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [handleGamepadConnected, handleGamepadDisconnected]);

  // Disconnect gamepad manually
  const disconnectGamepad = useCallback(() => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsGamepadConnected(false);
  }, []);

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack flex="auto" alignItems="center" justifyContent="center">
        {!leaveMode && (
          <>
            <div
              className="joystick"
              ref={joystickRef}
              onMouseDown={() => {
                setIsDragging(true);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
            >
              <div
                className="handle"
                style={{
                  transform: `translate(-50%, -50%) translate(${viewPosition.x * 50}%, ${
                    viewPosition.y * 50
                  }%)`,
                }}
              ></div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <Button
                onClick={() => {
                  setIsEmergency(!isEmergency);
                }}
                variant="contained"
                color={isEmergency ? "success" : "error"}
                style={{ marginTop: "8px", width: "100%", height: "50px" }}
              >
                {" "}
                {isEmergency ? "Emergency Stop Cancel" : "Emergency Stop"}{" "}
              </Button>
              <p>Gamepad Status: {isGamepadConnected ? "Connected" : "Disconnected"}</p>
              {isGamepadConnected && (
                <Button
                  onClick={disconnectGamepad}
                  style={{ marginTop: "8px", width: "100%", height: "50px" }}
                >
                  Disconnect Gamepad
                </Button>
              )}
            </div>
          </>
        )}
        {leaveMode && <div>Placeholder</div>}
      </Stack>
    </Stack>
  );
}

function TeleopPanelAdapter(props: Props) {
  return <Joystick {...props} />;
}

const defaultConfig: Joysetting = {
  vel: 0.2,
  topic: "/cmd_vel",
  angle: 0.8,
  mode: false,
};

export default Panel(Object.assign(TeleopPanelAdapter, {
  panelType: "Joystick",
  defaultConfig
}));
