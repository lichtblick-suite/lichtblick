// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { alpha } from "@mui/material";
import { useCallback, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const useStyles = makeStyles<void, "buttonIcon">()((theme, _params, classes) => ({
  svg: {
    label: "DirectionalPad-svg",
    maxHeight: "100%",
    maxWidth: "100%",
  },
  button: {
    label: "DirectionalPad-button",
    cursor: "pointer",
    fill: theme.palette.action.hover,
    stroke: theme.palette.divider,
    strokeWidth: 0.5,

    "&:hover": {
      fill: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity,
      ),
      stroke: theme.palette.primary.main,

      [`& + .${classes.buttonIcon}`]: {
        fill: theme.palette.primary.main,
      },
    },
    "&.active": {
      fill: `${theme.palette.primary.main} !important`,
      stroke: `${theme.palette.primary.dark} !important`,

      "&:hover": {
        [`& + .${classes.buttonIcon}`]: {
          fill: theme.palette.common.white,
        },
      },
    },
    "&.disabled": {
      cursor: "auto",
      strokeWidth: 0,
      fill: theme.palette.action.disabledBackground,

      "&:hover": {
        fill: theme.palette.action.disabledBackground,

        [`& + .${classes.buttonIcon}`]: {
          fill: theme.palette.background.default,
        },
      },
    },
  },
  buttonIcon: {
    pointerEvents: "none",
    label: "DirectionalPad-buttonIcon",
    fill: theme.palette.text.primary,

    "&.disabled": {
      fill: theme.palette.background.default,
    },
  },
}));

export enum DirectionalPadAction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

type DirectionalPadProps = {
  disabled?: boolean;
  onAction?: (action?: DirectionalPadAction) => void;
};

function DirectionalPad(props: DirectionalPadProps): JSX.Element {
  const { onAction, disabled = false } = props;

  const [currentAction, setCurrentAction] = useState<DirectionalPadAction | undefined>();

  const { classes, cx } = useStyles();

  const handleMouseDown = useCallback(
    (action: DirectionalPadAction) => {
      setCurrentAction(action);
      onAction?.(action);
    },
    [onAction],
  );

  const handleMouseUp = useCallback(() => {
    if (currentAction == undefined) {
      return;
    }
    setCurrentAction(undefined);
    onAction?.();
  }, [onAction, currentAction]);

  const makeMouseHandlers = (action: DirectionalPadAction) =>
    disabled
      ? undefined
      : {
          onMouseDown: () => handleMouseDown(action),
          onMouseUp: () => handleMouseUp(),
          onMouseLeave: () => handleMouseUp(),
        };

  return (
    <Stack
      justifyContent="center"
      alignItems="center"
      fullWidth
      fullHeight
      style={{ userSelect: "none" }}
    >
      <svg className={classes.svg} viewBox="0 0 256 256">
        <g opacity={1}>
          {/* UP button */}
          <g {...makeMouseHandlers(DirectionalPadAction.UP)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.UP,
                disabled,
              })}
              d="M162.707,78.945c-20.74,-14.771 -48.795,-14.771 -69.535,-0l-42.723,-42.723c44.594,-37.791 110.372,-37.794 154.981,-0l-42.723,42.723Z"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d="M128,30.364l20,20l-40,-0l20,-20Z"
            />
          </g>

          {/* DOWN button */}
          <g {...makeMouseHandlers(DirectionalPadAction.DOWN)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.DOWN,
                disabled,
              })}
              d="M93.172,176.764c20.74,14.771 48.795,14.771 69.535,0l42.723,42.723c-44.594,37.791 -110.372,37.794 -154.981,0l42.723,-42.723Z"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d="M128,225.345l-20,-20l40,0l-20,20Z"
            />
          </g>
        </g>

        <g opacity={1}>
          {/* LEFT button */}
          <g {...makeMouseHandlers(DirectionalPadAction.LEFT)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.LEFT,
                disabled,
              })}
              d="M36.307,205.345c-37.793,-44.609 -37.791,-110.387 -0,-154.981l42.723,42.723c-14.771,20.74 -14.771,48.795 -0,69.535l-42.723,42.723Z"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d="M30.449,127.854l20,-20l0,40l-20,-20Z"
            />
          </g>

          {/* RIGHT button */}
          <g {...makeMouseHandlers(DirectionalPadAction.RIGHT)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.RIGHT,
                disabled,
              })}
              d="M219.572,50.364c37.794,44.609 37.791,110.387 0.001,154.981l-42.724,-42.723c14.771,-20.74 14.771,-48.795 0,-69.535l42.723,-42.723Z"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d="M225.43,127.854l-20,20l0,-40l20,20Z"
            />
          </g>
        </g>
      </svg>
    </Stack>
  );
}

export default DirectionalPad;
