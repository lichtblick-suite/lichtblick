// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable no-restricted-syntax */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable react/forbid-component-props */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-unsafe-argument */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public License, v2.0.
// If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/

import CpuIcon from "@mui/icons-material/Memory";
import NetworkIcon from "@mui/icons-material/NetworkCheck";
import MemoryIcon from "@mui/icons-material/SdStorage";
import SystemIcon from "@mui/icons-material/Settings";
import DiskIcon from "@mui/icons-material/Storage";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";

type HardwareInfo = {
  timestamp: number;
  cpu: {
    percent: number;
    freq_mhz: number;
    temp_c: number;
    count: {
      physical: number;
      logical: number;
    };
  };
  memory: {
    total_gb: number;
    used_gb: number;
    percent: number;
  };
  swap: {
    total_gb: number;
    used_gb: number;
    percent: number;
  };
  disk: Array<{
    device: string;
    mountpoint: string;
    fstype: string;
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
  }>;
  network: {
    bytes_sent_mb: number;
    bytes_recv_mb: number;
  };
  load_avg: {
    "1min": number;
    "5min": number;
    "15min": number;
  };
};

type HardwareInfoConfig = {
  hardwareInfoSource: string;
};

type Props = {
  config: HardwareInfoConfig;
  //   saveConfig: SaveConfig<HardwareInfoConfig>;
};

// 格式化数字到指定小数位
const formatNumber = (num: number, decimals = 1): string => {
  return num.toFixed(decimals);
};

// 根据百分比值返回对应的颜色
const getColorForPercent = (percent: number): string => {
  if (percent < 60) {
    return "success";
  }
  if (percent < 85) {
    return "warning";
  }
  return "error";
};

function HardwareInfoPanel(props: Props): React.JSX.Element {
  const { config } = props;
  const { hardwareInfoSource } = config;
  //   const theme = useTheme();

  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 订阅硬件信息主题
  const hardwareInfoMessages = useMessageDataItem(hardwareInfoSource);

  // 处理订阅到的硬件信息
  useEffect(() => {
    if (hardwareInfoMessages.length > 0) {
      const latestMsg = hardwareInfoMessages[hardwareInfoMessages.length - 1] as {
        queriedData: { value: { data: string | object } }[];
      };
      if (latestMsg.queriedData[0]) {
        try {
          const data = latestMsg.queriedData[0].value.data;
          // 如果数据是字符串，尝试解析JSON
          const parsedData = typeof data === "string" ? JSON.parse(data) : data;
          setHardwareInfo(parsedData);
          setLastUpdate(new Date());
        } catch (error) {
          console.error("Error processing hardware info data:", error);
        }
      }
    }
  }, [hardwareInfoMessages]);

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack flex="auto" gap={2} padding={2} overflow="auto">
        {hardwareInfo ? (
          <>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}
            >
              <Typography variant="h6" component="div">
                系统硬件信息
              </Typography>
              <Chip
                label={`更新于: ${lastUpdate?.toLocaleTimeString()}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>

            <Grid container spacing={2}>
              {/* CPU 信息卡片 */}
              <Grid item xs={12} md={6}>
                <Card elevation={2}>
                  <CardContent>
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                    >
                      <CpuIcon color="primary" />
                      处理器 (CPU)
                    </Typography>

                    <Stack>
                      <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            使用率
                          </Typography>
                          <Typography
                            variant="body2"
                            color={getColorForPercent(hardwareInfo.cpu.percent)}
                          >
                            {formatNumber(hardwareInfo.cpu.percent)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={hardwareInfo.cpu.percent}
                          color={
                            getColorForPercent(hardwareInfo.cpu.percent) as
                              | "success"
                              | "warning"
                              | "error"
                          }
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>

                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            频率
                          </Typography>
                          <Typography variant="body1">
                            {formatNumber(hardwareInfo.cpu.freq_mhz / 1000, 2)} GHz
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            温度
                          </Typography>
                          <Typography
                            variant="body1"
                            color={hardwareInfo.cpu.temp_c > 75 ? "error.main" : "text.primary"}
                          >
                            {formatNumber(hardwareInfo.cpu.temp_c)}°C
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            物理核心
                          </Typography>
                          <Typography variant="body1">{hardwareInfo.cpu.count.physical}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            逻辑核心
                          </Typography>
                          <Typography variant="body1">{hardwareInfo.cpu.count.logical}</Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* 内存信息卡片 */}
              <Grid item xs={12} md={6}>
                <Card elevation={2}>
                  <CardContent>
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                    >
                      <MemoryIcon color="primary" />
                      内存 (Memory)
                    </Typography>

                    <Stack>
                      <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            内存使用率
                          </Typography>
                          <Typography
                            variant="body2"
                            color={getColorForPercent(hardwareInfo.memory.percent)}
                          >
                            {formatNumber(hardwareInfo.memory.percent)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={hardwareInfo.memory.percent}
                          color={
                            getColorForPercent(hardwareInfo.memory.percent) as
                              | "success"
                              | "warning"
                              | "error"
                          }
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>

                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            总内存
                          </Typography>
                          <Typography variant="body1">
                            {formatNumber(hardwareInfo.memory.total_gb, 2)} GB
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            已使用
                          </Typography>
                          <Typography variant="body1">
                            {formatNumber(hardwareInfo.memory.used_gb, 2)} GB
                          </Typography>
                        </Grid>
                      </Grid>

                      <Divider />

                      <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            交换分区使用率
                          </Typography>
                          <Typography
                            variant="body2"
                            color={getColorForPercent(hardwareInfo.swap.percent)}
                          >
                            {formatNumber(hardwareInfo.swap.percent)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={hardwareInfo.swap.percent}
                          color={
                            getColorForPercent(hardwareInfo.swap.percent) as
                              | "success"
                              | "warning"
                              | "error"
                          }
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>

                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            交换分区大小
                          </Typography>
                          <Typography variant="body1">
                            {formatNumber(hardwareInfo.swap.total_gb, 2)} GB
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            已使用
                          </Typography>
                          <Typography variant="body1">
                            {formatNumber(hardwareInfo.swap.used_gb, 2)} GB
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* 系统负载卡片 */}
              <Grid item xs={12} md={6}>
                <Card elevation={2}>
                  <CardContent>
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                    >
                      <SystemIcon color="primary" />
                      系统负载 (Load Average)
                    </Typography>

                    <Box sx={{ display: "flex", justifyContent: "space-around", pt: 1 }}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          1分钟
                        </Typography>
                        <Box sx={{ position: "relative", display: "inline-flex" }}>
                          <CircularProgress
                            variant="determinate"
                            value={Math.min(
                              (hardwareInfo.load_avg["1min"] / hardwareInfo.cpu.count.logical) *
                                100,
                              100,
                            )}
                            color={
                              getColorForPercent(
                                (hardwareInfo.load_avg["1min"] / hardwareInfo.cpu.count.logical) *
                                  100,
                              ) as "success" | "warning" | "error"
                            }
                            size={80}
                          />
                          <Box
                            sx={{
                              top: 0,
                              left: 0,
                              bottom: 0,
                              right: 0,
                              position: "absolute",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Typography variant="body1" component="div">
                              {formatNumber(hardwareInfo.load_avg["1min"], 2)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          5分钟
                        </Typography>
                        <Box sx={{ position: "relative", display: "inline-flex" }}>
                          <CircularProgress
                            variant="determinate"
                            value={Math.min(
                              (hardwareInfo.load_avg["5min"] / hardwareInfo.cpu.count.logical) *
                                100,
                              100,
                            )}
                            color={
                              getColorForPercent(
                                (hardwareInfo.load_avg["5min"] / hardwareInfo.cpu.count.logical) *
                                  100,
                              ) as "success" | "warning" | "error"
                            }
                            size={80}
                          />
                          <Box
                            sx={{
                              top: 0,
                              left: 0,
                              bottom: 0,
                              right: 0,
                              position: "absolute",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Typography variant="body1" component="div">
                              {formatNumber(hardwareInfo.load_avg["5min"], 2)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          15分钟
                        </Typography>
                        <Box sx={{ position: "relative", display: "inline-flex" }}>
                          <CircularProgress
                            variant="determinate"
                            value={Math.min(
                              (hardwareInfo.load_avg["15min"] / hardwareInfo.cpu.count.logical) *
                                100,
                              100,
                            )}
                            color={
                              getColorForPercent(
                                (hardwareInfo.load_avg["15min"] / hardwareInfo.cpu.count.logical) *
                                  100,
                              ) as "success" | "warning" | "error"
                            }
                            size={80}
                          />
                          <Box
                            sx={{
                              top: 0,
                              left: 0,
                              bottom: 0,
                              right: 0,
                              position: "absolute",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Typography variant="body1" component="div">
                              {formatNumber(hardwareInfo.load_avg["15min"], 2)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* 网络信息卡片 */}
              <Grid item xs={12} md={6}>
                <Card elevation={2}>
                  <CardContent>
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                    >
                      <NetworkIcon color="primary" />
                      网络 (Network)
                    </Typography>

                    <Grid container spacing={2} sx={{ pt: 1 }}>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: "center" }}>
                          <Typography variant="body2" color="text.secondary">
                            发送数据
                          </Typography>
                          <Typography variant="h5" component="div" color="primary.main">
                            {formatNumber(hardwareInfo.network.bytes_sent_mb, 2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            MB
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={6}>
                        <Box sx={{ textAlign: "center" }}>
                          <Typography variant="body2" color="text.secondary">
                            接收数据
                          </Typography>
                          <Typography variant="h5" component="div" color="primary.main">
                            {formatNumber(hardwareInfo.network.bytes_recv_mb, 2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            MB
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* 磁盘信息表格 */}
              <Grid item xs={12}>
                <Card elevation={2}>
                  <CardContent>
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                    >
                      <DiskIcon color="primary" />
                      磁盘 (Disk)
                    </Typography>

                    <TableContainer component={Paper} elevation={0} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>设备</TableCell>
                            <TableCell>挂载点</TableCell>
                            <TableCell>文件系统</TableCell>
                            <TableCell>总容量</TableCell>
                            <TableCell>已使用</TableCell>
                            <TableCell>可用</TableCell>
                            <TableCell>使用率</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {hardwareInfo.disk.map((disk, index) => (
                            <TableRow key={index} hover>
                              <TableCell>{disk.device}</TableCell>
                              <TableCell>{disk.mountpoint}</TableCell>
                              <TableCell>{disk.fstype}</TableCell>
                              <TableCell>{formatNumber(disk.total_gb, 1)} GB</TableCell>
                              <TableCell>{formatNumber(disk.used_gb, 1)} GB</TableCell>
                              <TableCell>{formatNumber(disk.free_gb, 1)} GB</TableCell>
                              <TableCell>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={disk.percent}
                                    color={
                                      getColorForPercent(disk.percent) as
                                        | "success"
                                        | "warning"
                                        | "error"
                                    }
                                    sx={{ height: 8, borderRadius: 1, width: "60px" }}
                                  />
                                  <Typography
                                    variant="body2"
                                    color={getColorForPercent(disk.percent)}
                                  >
                                    {formatNumber(disk.percent, 1)}%
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        ) : (
          <Box
            sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}
          >
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              正在加载硬件信息...
            </Typography>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}

const defaultConfig: HardwareInfoConfig = {
  hardwareInfoSource: "/hardware_info",
};

export default Panel(Object.assign(HardwareInfoPanel, {
  panelType: "HardwareInfoPanel",
  defaultConfig
}));
