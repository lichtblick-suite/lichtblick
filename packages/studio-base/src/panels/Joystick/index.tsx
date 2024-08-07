// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import React, { useState, useRef, useEffect } from "react";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import usePublisher from "@foxglove/studio-base/hooks/usePublisher";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { useCodeServerSettings } from "./settings";
import { Joysetting } from "./types";

import "./Joystick.css";

type Props = {
  config: Joysetting;
  saveConfig: SaveConfig<Joysetting>;
};
interface Position {
  x1: number;
  y: number;
}

function Joystick(props: Props): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x1: 0, y: 0 });
  const [viewPosition, setVPosition] = useState<Position>({ x1: 0, y: 0 });
  const { topics, datatypes } = useDataSourceInfo();
  const { config, saveConfig } = props;
  useCodeServerSettings(config, saveConfig, topics);

  const cmdPublish = usePublisher({
    name: "Publish",
    topic: config.topic,
    schemaName: "geometry_msgs/msg/Twist",
    datatypes,
  });

  const startDragMouse = () => {
    setIsDragging(true);
  };

  const dragMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const rect = joystickRef.current!.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;
      const distance = Math.min(rect.width / 2, rect.height / 2);
      const angle = Math.atan2(offsetY, offsetX);

      let x1 = Math.cos(angle) * (Math.min(Math.abs(offsetX), distance) / distance);
      let y = Math.sin(angle) * (Math.min(Math.abs(offsetY), distance) / distance);
      setVPosition({ x1, y });

      // 控制输出范围在 -1 到 1 之间
      x1 = Math.max(-1 * config.angle, Math.min(config.angle, x1));
      y = Math.max(-1 * config.vel, Math.min(config.vel, y));

      setPosition({ x1, y });
    }
  };

  const endDragMouse = () => {
    setIsDragging(false);
    setPosition({ x1: 0, y: 0 });
    setVPosition({ x1: 0, y: 0 });
  };

  const startDrag = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    try {
      cmdPublish({
        linear: {
          x: position.y * -1,
          y: 0,
          z: 0,
        },
        angular: {
          x: 0,
          y: 0,
          z: position.x1 * -1,
        },
      } as Record<string, unknown>);
    } catch (error) {
      console.error(error);
    }

    // 在这里可以执行你想要的操作，例如将x和y的值传递给其他组件或进行其他处理
  }, [position.x1, position.y, cmdPublish]);

  const drag = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) {
      const rect = joystickRef.current!.getBoundingClientRect();
      const touch = e.touches[0];
      const offsetX = touch!.clientX - rect.left - rect.width / 2;
      const offsetY = touch!.clientY - rect.top - rect.height / 2;
      const distance = Math.min(rect.width / 2, rect.height / 2);
      const angle = Math.atan2(offsetY, offsetX);

      let x1 = Math.cos(angle) * (Math.min(Math.abs(offsetX), distance) / distance);
      let y = Math.sin(angle) * (Math.min(Math.abs(offsetY), distance) / distance);
      setVPosition({ x1, y });

      // 控制输出范围在 -1 到 1 之间
      x1 = Math.max(-1 * config.angle, Math.min(config.angle, x1));
      y = Math.max(-1 * config.vel, Math.min(config.vel, y));

      setPosition({ x1, y });
    }
  };

  const endDrag = () => {
    setIsDragging(false);
    setPosition({ x1: 0, y: 0 });
    setVPosition({ x1: 0, y: 0 });
  };

  const joystickRef = useRef<HTMLDivElement>(null);

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack flex="auto" alignItems="center" justifyContent="center">
        <div
          className="joystick"
          ref={joystickRef}
          onTouchStart={startDrag}
          onTouchMove={drag}
          onTouchEnd={endDrag}
          onMouseDown={startDragMouse}
          onMouseMove={dragMouse}
          onMouseUp={endDragMouse}
        >
          <div
            className="handle"
            style={{
              transform: `translate(-50%, -50%) translate(${viewPosition.x1 * 50}%, ${
                viewPosition.y * 50
              }%)`,
            }}
          ></div>
        </div>
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
};
export default Panel(
  Object.assign(TeleopPanelAdapter, {
    panelType: "Joystick",
    defaultConfig,
  }),
);
