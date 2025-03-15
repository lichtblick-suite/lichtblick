// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable react/forbid-component-props */

import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI/useDataSourceInfo";
import Stack from "@lichtblick/suite-base/components/Stack";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import usePublisher from "@lichtblick/suite-base/hooks/usePublisher";

// 示例数据结构，你可以替换成你的自定义内容
type LaunchFileMap = {
  [packageName: string]: string[];
};

type LaunchSelectorProps = {
  startLaunchTopic: string;
  launchFilesMap: LaunchFileMap;
};

function LaunchSelector({
  startLaunchTopic,
  launchFilesMap,
}: LaunchSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedLaunch, setSelectedLaunch] = useState<string>("");
  const [availableLaunches, setAvailableLaunches] = useState<string[]>([]);
  const { datatypes } = useDataSourceInfo();

  // 设置发布器
  const startLaunchPublisher = usePublisher({
    name: "StartLaunch",
    topic: startLaunchTopic,
    schemaName: "std_msgs/String", // 根据实际情况调整
    datatypes,
  });

  // 当选择的包发生变化时，更新可用的启动文件列表
  useEffect(() => {
    if (selectedPackage && launchFilesMap[selectedPackage]) {
      // 修改后
      setAvailableLaunches(launchFilesMap[selectedPackage] ?? []);

      setSelectedLaunch(""); // 重置启动文件选择
    } else {
      setAvailableLaunches([]);
      setSelectedLaunch("");
    }
  }, [selectedPackage, launchFilesMap]);

  // 处理包名选择变化
  const handlePackageChange = (event: SelectChangeEvent) => {
    setSelectedPackage(event.target.value);
  };

  // 处理启动文件选择变化
  const handleLaunchChange = (event: SelectChangeEvent) => {
    setSelectedLaunch(event.target.value);
  };

  // 发送启动进程命令
  const startProcess = useCallbackWithToast(() => {
    if (startLaunchTopic && selectedPackage && selectedLaunch) {
      const startLaunchMsg = {
        package: selectedPackage,
        launch_file: selectedLaunch,
        args: "",
      };
      startLaunchPublisher({ data: JSON.stringify(startLaunchMsg) } as Record<string, unknown>);
    } else {
      throw new Error("请选择包名和启动文件");
    }
  }, [startLaunchTopic, selectedPackage, selectedLaunch, startLaunchPublisher]);

  return (
    <Paper elevation={2} sx={{ padding: 2 }}>
      <Typography
        variant="h6"
        sx={{
          marginBottom: 2,
          color: theme.palette.primary.main,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <AddIcon fontSize="small" />
        启动新的进程
      </Typography>

      <Stack direction="row" alignItems="flex-end">
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="package-select-label">包名 (Package)</InputLabel>
          <Select
            labelId="package-select-label"
            id="package-select"
            value={selectedPackage}
            label="包名 (Package)"
            onChange={handlePackageChange}
          >
            {Object.keys(launchFilesMap).map((pkg) => (
              <MenuItem key={pkg} value={pkg}>
                {pkg}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="launch-select-label">启动文件 (Launch File)</InputLabel>
          <Select
            labelId="launch-select-label"
            id="launch-select"
            value={selectedLaunch}
            label="启动文件 (Launch File)"
            onChange={handleLaunchChange}
            disabled={!selectedPackage}
          >
            {availableLaunches.map((launch) => (
              <MenuItem key={launch} value={launch}>
                {launch}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="success"
          startIcon={<PlayArrowIcon />}
          onClick={startProcess}
          disabled={!selectedPackage || !selectedLaunch}
        >
          启动
        </Button>
      </Stack>
    </Paper>
  );
}

export default LaunchSelector;
