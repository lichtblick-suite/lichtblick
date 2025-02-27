// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LinearProgress, Typography, Card } from "@mui/material";
import React from "react";

interface BatteryIndicatorProps {
  batteryLevel: number; // 电量百分比 (0 - 100)
}

const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({ batteryLevel }) => {
  // 确保电量在 0 到 100 之间，并保留整数
  const clampedBatteryLevel = Math.round(Math.min(Math.max(batteryLevel, 0), 100));

  // 根据电量设置进度条颜色
  const getColor = (level: number) => {
    if (level <= 20) {
      return "error";
    } // 红色，表示低电量
    if (level <= 50) {
      return "warning";
    } // 黄色，表示中等电量
    return "success"; // 绿色，表示高电量
  };

  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        height: 100, // 设置卡片高度
        width: 60, // 设置卡片宽度
        padding: 1, // 内边距
        borderRadius: 2, // 设置圆角
        boxShadow: 3, // 设置阴影
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {clampedBatteryLevel}%
      </Typography>
      <div
        style={{
          height: "70%", // 进度条高度
          width: 8, // 进度条宽度
          position: "relative",
          borderRadius: 4, // 设置圆角
          backgroundColor: "rgba(0, 0, 0, 0.1)", // 背景色
          overflow: "hidden",
        }}
      >
        <LinearProgress
          variant="determinate"
          value={clampedBatteryLevel}
          color={getColor(clampedBatteryLevel)}
          sx={{
            height: `${clampedBatteryLevel}%`, // 根据电量设置高度
            width: "100%",
            position: "absolute",
            bottom: 0, // 从底部开始填充
            borderRadius: 4, // 设置圆角
          }}
        />
      </div>
    </Card>
  );
};

export default BatteryIndicator;
