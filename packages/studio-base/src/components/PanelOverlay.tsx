// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Backdrop,
  Button,
  ButtonProps,
  Chip,
  ClickAwayListener,
  Paper,
  buttonClasses,
} from "@mui/material";
import * as _ from "lodash-es";
import { forwardRef } from "react";
import { ReactElement } from "react-markdown/lib/react-markdown";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { PANEL_ROOT_CLASS_NAME } from "@foxglove/studio-base/components/PanelRoot";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";

const useStyles = makeStyles<void, "buttonGroup">()((theme, _params, classes) => {
  const transparentBackground = tc(theme.palette.background.default).setAlpha(0).toRgbString();
  const hoverBackground = tc(theme.palette.background.default)
    .setAlpha(1 - theme.palette.action.disabledOpacity)
    .toRgbString();
  const hoverPrimary = tc(theme.palette.primary.main)
    .setAlpha(theme.palette.action.hoverOpacity)
    .toRgbString();

  return {
    backdrop: {
      position: "absolute",
      zIndex: theme.zIndex.modal - 1,
      padding: theme.spacing(2),
      container: "backdrop / size",
      backgroundColor: transparentBackground,
    },
    invalidTarget: {
      backgroundColor: hoverBackground,
    },
    validTarget: {
      alignItems: "flex-end",
      backgroundColor: hoverPrimary,
    },
    selected: {
      backgroundImage: `linear-gradient(to bottom, ${hoverPrimary}, ${hoverPrimary})`,
      backgroundColor: hoverBackground,
    },
    highlightActive: {
      [`.${PANEL_ROOT_CLASS_NAME}:not(:hover) &`]: {
        visibility: "hidden",
      },
    },
    highlightAll: {
      [`.${PANEL_ROOT_CLASS_NAME}:not(:hover) &`]: {
        [`.${classes.buttonGroup}`]: { visibility: "hidden" },
      },
    },
    buttonGroup: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: theme.spacing(1),

      "@container backdrop (max-height: 80px)": {
        flexDirection: "row",
      },
      "@container backdrop (min-height: 120px)": {
        marginTop: PANEL_TOOLBAR_MIN_HEIGHT,
      },
      "@container backdrop (min-width: 240px)": {
        flexDirection: "row",
      },
    },
    buttonPaper: {
      flex: "0 0 50%",
      minWidth: "50%",
    },
    button: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      whiteSpace: "nowrap",
      textAlign: "left",

      [`.${buttonClasses.startIcon}`]: {
        position: "relative",
        margin: 0,

        svg: {
          height: "1em",
          width: "1em",
          fontSize: 32,
        },
      },
    },
    buttonText: {
      "@container backdrop (max-width: 120px)": {
        display: "none",
      },
      "@container backdrop (max-height: 80px)": {
        display: "none",
      },
    },
    chip: {
      boxShadow: theme.shadows[2],
      paddingInline: theme.spacing(2),
    },
  };
});

export type PanelOverlayProps = {
  actions?: {
    key: string;
    text: string;
    icon: ReactElement;
    onClick?: () => void;
    color?: ButtonProps["color"];
  }[];
  dropMessage?: string;
  highlightMode?: "active" | "all";
  open: boolean;
  variant?: "validDropTarget" | "invalidDropTarget" | "selected";
  onClickAway?: () => void;
};

export const PanelOverlay = forwardRef<HTMLDivElement, PanelOverlayProps>(
  function PanelOverlay(props, ref): JSX.Element | ReactNull {
    const { actions, variant, highlightMode, dropMessage, open, onClickAway } = props;
    const { classes, cx } = useStyles();

    return (
      <ClickAwayListener onClickAway={onClickAway ? onClickAway : _.noop}>
        <Backdrop
          transitionDuration={0}
          unmountOnExit
          ref={ref}
          open={open}
          className={cx(classes.backdrop, {
            [classes.invalidTarget]: variant === "invalidDropTarget",
            [classes.validTarget]: variant === "validDropTarget",
            [classes.selected]: variant === "selected",
            [classes.highlightActive]: highlightMode === "active",
            [classes.highlightAll]: highlightMode === "all",
          })}
        >
          {dropMessage && variant === "validDropTarget" ? (
            <Chip size="small" color="primary" label={dropMessage} className={classes.chip} />
          ) : (
            actions && (
              <div className={classes.buttonGroup}>
                {actions.map((action) => (
                  <Paper
                    square={false}
                    key={action.key}
                    elevation={0}
                    className={classes.buttonPaper}
                  >
                    <Button
                      fullWidth
                      variant="outlined"
                      className={classes.button}
                      onClick={action.onClick}
                      startIcon={action.icon}
                      color={action.color}
                    >
                      <div className={classes.buttonText}>{action.text}</div>
                    </Button>
                  </Paper>
                ))}
              </div>
            )
          )}
        </Backdrop>
      </ClickAwayListener>
    );
  },
);
