// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import type { CSSProperties } from "react";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()(() => ({
  root: {
    fontFamily: "Arial, sans-serif",
    color: "#333",
  },
  title: {
    textAlign: "center",
    fontSize: "24px",
    marginBottom: "20px",
  },
}));

export const tooltipStyle: CSSProperties = {
  backgroundColor: "rgba(255, 255, 255, 0.8)",
  borderRadius: "10px",
  border: "none",
  color: "#fff",
  fontSize: "14px",
  padding: "10px",
  boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
};
