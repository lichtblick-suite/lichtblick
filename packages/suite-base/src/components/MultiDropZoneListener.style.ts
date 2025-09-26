// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()(({ palette, spacing, shadows }) => ({
  hiddenFileInput: {
    display: "none",
  },

  overlay: {
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    backdropFilter: "blur(2px)",
  },

  topRow: {
    display: "flex",
    height: "55%", // Top 55% for extensions/layouts
  },

  bottomRow: {
    display: "flex",
    height: "45%", // Bottom 45% for data sources
  },

  dropZoneVertical: {
    width: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: `1px solid ${palette.divider}`,

    "&:last-child": {
      borderRight: "none",
    },
  },

  dropZoneHorizontal: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderTop: `1px solid ${palette.divider}`,
  },

  dropZoneActive: {
    border: "3px dashed !important",
    boxShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
  },

  dropZoneLocal: {
    backgroundColor: "rgba(0, 122, 204, 0.1)",
    borderColor: "#007acc",
  },

  dropZoneSource: {
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    borderColor: "#2ecc71",
  },

  dropZoneOrg: {
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    borderColor: "#ff6600",
  },

  dropIndicator: {
    padding: spacing(3.75),
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: spacing(1.5),
    fontSize: "16px",
    fontWeight: "bold",
    textAlign: "center",
    boxShadow: shadows[8],
  },

  dropIndicatorLocal: {
    color: "#007acc",
  },

  dropIndicatorSource: {
    color: "#2ecc71",
  },

  dropIndicatorOrg: {
    color: "#ff6600",
  },

  dropExtensions: {
    fontSize: "12px",
    marginTop: spacing(1),
    opacity: 0.8,
  },
}));
