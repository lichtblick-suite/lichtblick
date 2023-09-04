// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { alpha } from "@mui/material";
import { forwardRef, HTMLAttributes, PropsWithChildren } from "react";
import { TransitionStatus } from "react-transition-group";
import { makeStyles } from "tss-react/mui";

import { APP_BAR_HEIGHT } from "@foxglove/studio-base/components/AppBar/constants";

export const PANEL_ROOT_CLASS_NAME = "FoxglovePanelRoot-root";

type PanelRootProps = {
  fullscreenState: TransitionStatus;
  selected: boolean;
  sourceRect: DOMRectReadOnly | undefined;
  hasFullscreenDescendant: boolean;
} & HTMLAttributes<HTMLDivElement>;

const useStyles = makeStyles<Omit<PanelRootProps, "fullscreenState" | "selected">>()(
  (theme, props) => {
    const { palette, transitions } = theme;
    const { sourceRect, hasFullscreenDescendant } = props;
    const duration = transitions.duration.shorter;

    return {
      root: {
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        overflow: "hidden",
        backgroundColor: palette.background.default,
        border: `0px solid ${alpha(palette.primary.main, 0.67)}`,
        transition: transitions.create("border-width", {
          duration, // match to timeout duration inside Panel component
        }),

        "::after": {
          content: "''",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          inset: 1,
          opacity: 0,
          border: `1px solid ${palette.primary.main}`,
          position: "absolute",
          pointerEvents: "none",
          transition: "opacity 0.05s ease-out",
          zIndex: 10000 + 1,
        },
      },
      rootSelected: {
        "::after": {
          opacity: 1,
          transition: "opacity 0.125s ease-out",
        },
      },
      entering: {
        position: "fixed",
        top: sourceRect?.top ?? 0,
        left: sourceRect?.left ?? 0,
        right: sourceRect ? window.innerWidth - sourceRect.right : 0,
        bottom: sourceRect ? window.innerHeight - sourceRect.bottom : 0,
        zIndex: 10000,
      },
      entered: {
        borderWidth: 4,
        position: "fixed",
        top: APP_BAR_HEIGHT, // offset by app bar height
        left: 0,
        right: 0,
        bottom: 77, // match PlaybackBar height
        zIndex: 10000,
        transition: transitions.create(["border-width", "top", "right", "bottom", "left"], {
          duration, // match to timeout duration inside Panel component
        }),
      },
      exiting: {
        position: "fixed",
        top: sourceRect?.top ?? 0,
        left: sourceRect?.left ?? 0,
        right: sourceRect ? window.innerWidth - sourceRect.right : 0,
        bottom: sourceRect ? window.innerHeight - sourceRect.bottom : 0,
        zIndex: 10000,
        transition: transitions.create(["border-width", "top", "right", "bottom", "left"], {
          duration, // match to timeout duration inside Panel component
        }),
      },
      exited: {
        position: "relative",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // "z-index: 1" makes panel drag & drop work more reliably (see
        // https://github.com/foxglove/studio/pull/3355), but it also makes fullscreen panels get
        // overlapped by other parts of the panel layout. So we turn it back to auto when a
        // descendant is fullscreen.
        zIndex: hasFullscreenDescendant ? "auto" : 1,
      },
    };
  },
);

export const PanelRoot = forwardRef<HTMLDivElement, PropsWithChildren<PanelRootProps>>(
  function PanelRoot(props, ref): JSX.Element {
    const { className, fullscreenState, hasFullscreenDescendant, selected, sourceRect, ...rest } =
      props;
    const { classes, cx } = useStyles({ sourceRect, hasFullscreenDescendant });

    const classNames = cx(PANEL_ROOT_CLASS_NAME, className, classes.root, {
      [classes.entering]: fullscreenState === "entering",
      [classes.entered]: fullscreenState === "entered",
      [classes.exiting]: fullscreenState === "exiting",
      [classes.exited]: fullscreenState === "exited",
      [classes.rootSelected]: selected,
    });

    return (
      <div ref={ref} className={classNames} {...rest}>
        {props.children}
      </div>
    );
  },
);
