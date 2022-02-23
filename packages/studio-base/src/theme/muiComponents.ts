// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Theme, ThemeOptions } from "@mui/material/styles";
import { CSSProperties } from "@mui/styles";

type MuiLabComponents = {
  MuiFocusVisible?: {
    styleOverrides?: {
      root?: CSSProperties;
    };
  };
  MuiToggleButton?: {
    styleOverrides?: {
      root?: CSSProperties;
      label?: CSSProperties;
    };
  };
  MuiToggleButtonGroup?: {
    styleOverrides?: {
      root?: CSSProperties;
    };
  };
};

const iconHack = {
  "& svg:not(.MuiSvgIcon-root)": {
    fill: "currentColor",
    width: "1em",
    height: "1em",
    display: "inline-block",
    fontSize: "1.2857142857142856rem",
    transition: "fill 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
    flexShrink: 0,
    userSelect: "none",
  },
};

export default function muiComponents(theme: Theme): ThemeOptions["components"] & MuiLabComponents {
  const prefersDarkMode = theme.palette.mode === "dark";

  return {
    MuiFocusVisible: {
      styleOverrides: {
        root: {
          borderRadius: theme.shape.borderRadius,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        "@global": {
          svg: {
            display: "block",
            maxWidth: "100%",
          },
        },
      },
    },
    MuiAvatar: {
      defaultProps: {
        variant: "rounded",
      },
      styleOverrides: {
        colorDefault: {
          color: "currentColor",
          backgroundColor: theme.palette.action.hover,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiButtonBase: {},
    MuiIconButton: {
      defaultProps: {
        centerRipple: false,
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: theme.shape.borderRadius,
          ...iconHack,

          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        variant: "outlined",
        square: false,
      },
    },
    MuiCardActionArea: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          "&:last-child": {
            paddingBottom: theme.spacing(2),
          },
        },
      },
    },
    MuiCardHeader: {
      defaultProps: {
        titleTypographyProps: {
          variant: "h3",
        },
      },
      styleOverrides: {
        action: {
          alignSelf: undefined,
          marginTop: undefined,
          marginRight: undefined,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 2,
        square: true,
      },
    },
    MuiListItemButton: {
      defaultProps: { disableRipple: true },
    },
    MuiLink: {
      defaultProps: {
        color: prefersDarkMode ? "secondary" : "primary",
      },
      styleOverrides: {
        root: {
          cursor: "ppointer",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: theme.shape.borderRadius,
        },
      },
    },
    MuiUseMediaQuery: {},
    MuiTab: {
      styleOverrides: {
        labelIcon: iconHack,
      },
    },
    MuiTableCell: {
      styleOverrides: {
        stickyHeader: {
          backgroundColor: theme.palette.background.paper,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          justifyContent: "space-between",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        label: iconHack,
      },
    },
  };
}
