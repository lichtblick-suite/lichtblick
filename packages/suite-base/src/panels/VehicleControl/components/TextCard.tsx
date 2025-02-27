// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Typography, Card } from "@mui/material";
import React from "react";

interface TextCardProps {
  text: string; // 要显示的字符串
  height?: number; // 卡片高度
}

const TextCard: React.FC<TextCardProps> = ({ text, height }) => {
  return (
    <Card
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: height || 60, // 设置卡片高度
        width: 60, // 设置卡片宽度
        padding: 1, // 内边距
        borderRadius: 2, // 设置圆角
        boxShadow: 3, // 设置阴影
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold", textAlign: "center" }}>
        {text}
      </Typography>
    </Card>
  );
};

export default TextCard;
