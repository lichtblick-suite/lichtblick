// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import tinycolor from "tinycolor2";
import { keyframes } from "tss-react";
import { makeStyles } from "tss-react/mui";

import { NODE_HEADER_MIN_HEIGHT } from "@lichtblick/suite-base/components/SettingsTreeEditor/constants";

export const useStyles = makeStyles()((theme) => ({
  actionButton: {
    padding: theme.spacing(0.5),
  },
  editNameField: {
    font: "inherit",
    gridColumn: "span 2",
    width: "100%",

    ".MuiInputBase-input": {
      fontSize: "0.75rem",
      padding: theme.spacing(0.75, 1),
    },
  },
  focusedNode: {
    animation: `
      ${keyframes`
      from {
        background-color: ${tinycolor(theme.palette.primary.main).setAlpha(0.3).toRgbString()};
      }
      to {
        background-color: transparent;
      }`}
      0.5s ease-in-out
    `,
  },
  fieldPadding: {
    gridColumn: "span 2",
    height: theme.spacing(0.5),
  },
  iconWrapper: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    top: "50%",
    left: 0,
    transform: "translate(-97.5%, -50%)",
  },

  nodeHeader: {
    display: "flex",
    gridColumn: "span 2",
    paddingRight: theme.spacing(0.5),
    minHeight: NODE_HEADER_MIN_HEIGHT,

    "@media (pointer: fine)": {
      ".MuiCheckbox-root": {
        visibility: "visible",
      },

      "[data-node-function=edit-label]": {
        visibility: "hidden",
      },

      "&:hover": {
        backgroundColor: theme.palette.action.hover,

        ".MuiCheckbox-root": {
          visibility: "visible",
        },

        "[data-node-function=edit-label]": {
          visibility: "visible",
        },
      },
    },
  },
  nodeHeaderVisible: {
    "@media (pointer: fine)": {
      ".MuiCheckbox-root": {
        visibility: "hidden",
      },
      "&:hover": {
        ".MuiCheckbox-root": {
          visibility: "visible",
        },
      },
    },
  },

  nodeHeaderToggle: {
    display: "grid",
    alignItems: "center",
    gridTemplateColumns: "auto 1fr auto",
    opacity: 0.6,
    position: "relative",
    userSelect: "none",
    width: "100%",
  },
  nodeHeaderToggleHasProperties: {
    cursor: "pointer",
  },
  nodeHeaderToggleVisible: {
    opacity: 1,
  },
  errorTooltip: {
    whiteSpace: "pre-line",
    maxHeight: "15vh",
    overflowY: "auto",
  },
}));
