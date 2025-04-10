// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { buttonClasses } from "@mui/material";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  tooltip: {
    maxWidth: "none",
  },
  resetZoomButton: {
    pointerEvents: "none",
    position: "absolute",
    display: "flex",
    justifyContent: "flex-end",
    paddingInline: theme.spacing(1),
    right: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    paddingBottom: theme.spacing(4),

    [`.${buttonClasses.root}`]: {
      pointerEvents: "auto",
    },
  },
  canvasDiv: {
    width: "100%",
    height: "100%",
    minHeight: 250, // 添加最小高度
    overflow: "hidden",
    cursor: "crosshair",
    "& canvas": {
      display: "block" // 修复canvas元素布局
    }
  },
  verticalBarWrapper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    position: "relative",
  },
  // 新增垂直布局样式
  verticalLayout: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    gap: theme.spacing(2),
  },
  // 新增单个图表容器样式
  plotContainer: {
    flex: 1,
    minHeight: 300,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    position: "relative",
    overflow: "hidden",
    // 保证图表内部元素布局
    "& > div": {
      height: "100%",
      width: "100%"
    },
    // 调整重置按钮在容器内的位置
    "& $resetZoomButton": {
      paddingBottom: theme.spacing(2)
    }
  },
  // 响应式调整
  "@media (max-height: 800px)": {
    plotContainer: {
      minHeight: 250
    }
  }
}));
