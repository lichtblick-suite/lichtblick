// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable react/forbid-component-props */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-unsafe-argument */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public License, v2.0.
// If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/

// 在主组件中
import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI/useDataSourceInfo";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import usePublisher from "@lichtblick/suite-base/hooks/usePublisher";
import {
  ActiveLaunchData,
  NodesMonitorConfig,
  ActiveNodeData,
  Props,
} from "@lichtblick/suite-base/panels/LaunchMotion/types"; // 导入上面创建的组件

import LaunchSelector from "./LaunchSelector";

// 添加自定义的启动文件映射
const launchFilesMap = {
  bootstrap: ["start.launch.py", "lidar_map.launch.py", "camera.launch.py"],
  ums_fiction_driver: ["ums_fiction_umscom.launch.py"],
  custom_rknn: ["detector.launch.py"],
  ascamera: ["hp60c.launch.py"],
  // 你可以添加更多的包和对应的启动文件
};

function NodesMonitorPanel(props: Props): React.JSX.Element {
  const { config } = props;
  const { activeNodeSource, activeLaunchSource, killLaunchTopic, startLaunchTopic } = config;
  const theme = useTheme();

  const [activeNodes, setActiveNodes] = useState<ActiveNodeData[]>([]);
  const [activeLaunch, setActiveLaunch] = useState<ActiveLaunchData[]>([]);

  // 订阅ROS主题
  const activeNodeMessages = useMessageDataItem(activeNodeSource);
  const activeLaunchMessages = useMessageDataItem(activeLaunchSource);
  const { datatypes } = useDataSourceInfo();

  // 设置发布器
  const killLaunchPublisher = usePublisher({
    name: "Publish",
    topic: killLaunchTopic,
    schemaName: "std_msgs/msg/String",
    datatypes,
  });

  const killProcess = (pid: number) => {
    const killLaunchMsg = {
      pid: `${pid}`,
    };
    killLaunchPublisher({ data: JSON.stringify(killLaunchMsg) } as Record<string, unknown>);
  };
  // 处理订阅到的节点信息
  useEffect(() => {
    if (activeNodeMessages.length > 0) {
      const latestMsg = activeNodeMessages[activeNodeMessages.length - 1] as {
        queriedData: { value: { data: string | object } }[];
      };
      if (latestMsg.queriedData.length > 0) {
        try {
          const nowData = JSON.parse(latestMsg.queriedData[0]?.value?.data as string);
          setActiveNodes(nowData);
        } catch (error) {
          console.error("Error processing active node data:", error);
        }
      }
    }
  }, [activeNodeMessages]);

  // 处理订阅到的启动文件信息
  useEffect(() => {
    if (activeLaunchMessages.length > 0) {
      const latestMsg = activeLaunchMessages[activeLaunchMessages.length - 1] as {
        queriedData: { value: { data: string | object } }[];
      };
      if (latestMsg.queriedData.length > 0) {
        try {
          // 处理嵌套的字符串格式
          const nowData = JSON.parse(latestMsg.queriedData[0]?.value?.data as string);
          setActiveLaunch(nowData);
        } catch (error) {
          console.error("Error parsing active launch data:", error);
        }
      }
    }
  }, [activeLaunchMessages]);

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack flex="auto" gap={2} padding={2} overflow="auto">
        <LaunchSelector startLaunchTopic={startLaunchTopic} launchFilesMap={launchFilesMap} />

        <Paper elevation={2}>
          <Typography
            variant="h6"
            sx={{
              padding: 1.5,
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            }}
          >
            启动文件 (Launch Files)
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="60px" sx={{ fontWeight: "bold" }}>
                    操作
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>PID</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>包名 (Package)</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>启动文件 (Launch File)</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>命令 (Command)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeLaunch.length > 0 ? (
                  activeLaunch.map((launch, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Tooltip title="终止进程">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              killProcess(launch.pid);
                            }}
                          >
                            X{/* <DeleteIcon fontSize="small" /> */}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{launch.pid}</TableCell>
                      <TableCell>{launch.package}</TableCell>
                      <TableCell>{launch.launch_file}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: "400px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {launch.command}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper elevation={2}>
          <Typography
            variant="h6"
            sx={{
              padding: 1.5,
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            }}
          >
            活动节点 (Active Nodes)
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>节点名称 (Node Name)</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>PID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeNodes.length > 0 ? (
                  activeNodes.map((node, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{node.node_name}</TableCell>
                      <TableCell>{node.pid}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </Stack>
  );
}

const defaultConfig: NodesMonitorConfig = {
  activeNodeSource: "/active_node",
  activeLaunchSource: "/active_launch",
  killLaunchTopic: "/kill_launch",
  startLaunchTopic: "/start_launch",
};

export default Panel(
  Object.assign(NodesMonitorPanel, {
    panelType: "ROS2NodesMonitorPanel",
    defaultConfig,
  }),
);
