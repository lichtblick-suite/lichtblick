// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";
import cx from "classnames";
import { useCallback, useState } from "react";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    userSelect: "none",
    width: "100%",
    height: "100%",
  },
  control: {
    maxHeight: "100%",
    maxWidth: "100%",
  },
});

const useButtonStyles = makeStyles(({ semanticColors }) => ({
  background: {
    cursor: "pointer",
    fill: semanticColors.bodyBackgroundHovered,
    stroke: semanticColors.buttonBorder,
    strokeWidth: 0.5,

    ":hover": {
      fill: semanticColors.bodyBackgroundChecked,

      "+ path": {
        fill: semanticColors.buttonTextHovered,
      },
    },
  },
  backgroundDisabled: {
    cursor: "not-allowed",
    strokeWidth: 0,

    fill: semanticColors.buttonBackgroundDisabled,
    ":hover": {
      fill: semanticColors.buttonBackgroundDisabled,

      "+ path": {
        fill: semanticColors.bodyBackground,
      },
    },
  },
  backgroundPressed: {
    fill: `${semanticColors.primaryButtonBackground} !important`,
    stroke: `${semanticColors.primaryButtonBackgroundPressed} !important`,

    ":hover": {
      "+ path": {
        fill: semanticColors.buttonTextHovered,
      },
    },
  },
  icon: {
    pointerEvents: "none",
    fill: semanticColors.buttonText,
  },
  iconDisabled: {
    fill: semanticColors.bodyBackground,
  },
}));

const useStopButtonStyles = makeStyles(({ fonts, semanticColors }) => ({
  background: {
    cursor: "pointer",
    fill: semanticColors.errorBackground,
    stroke: semanticColors.errorText,
    strokeWidth: 0.5,

    ":hover": {
      stroke: semanticColors.buttonText,

      "+ text": {
        fill: semanticColors.buttonText,
      },
    },
  },
  backgroundDisabled: {
    cursor: "auto !important",
    opacity: 0.4,
    stroke: semanticColors.errorBackground,

    ":hover": {
      stroke: `${semanticColors.errorBackground} !important`,
    },
  },
  text: {
    ...fonts.xxLarge,
    pointerEvents: "none",
    fill: semanticColors.errorText,
  },
  textDisabled: {
    fill: `${semanticColors.bodyBackground} !important`,
  },
}));

export enum DirectionalPadAction {
  STOP = 0,
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

type DirectionalPadProps = {
  disabled?: boolean;
  onAction?: (action?: DirectionalPadAction) => void;
  disableStop?: boolean;
};

function DirectionalPad(props: DirectionalPadProps): JSX.Element {
  const { onAction, disableStop = true, disabled = false } = props;

  const [currentAction, setCurrentAction] = useState<DirectionalPadAction | undefined>();

  const classes = useStyles();
  const buttonClasses = useButtonStyles();
  const stopButtonClasses = useStopButtonStyles();

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
    <div className={classes.root}>
      <svg className={classes.control} viewBox="0 0 256 256">
        <g opacity={1}>
          {/* UP button */}
          <g {...makeMouseHandlers(DirectionalPadAction.UP)} role="button">
            <path
              className={cx(buttonClasses.background, {
                [buttonClasses.backgroundDisabled]: disabled,
                [buttonClasses.backgroundPressed]: currentAction === DirectionalPadAction.UP,
              })}
              d="M162.707,78.945c-20.74,-14.771 -48.795,-14.771 -69.535,-0l-42.723,-42.723c44.594,-37.791 110.372,-37.794 154.981,-0l-42.723,42.723Z"
            />
            <path
              className={cx(buttonClasses.icon, { [buttonClasses.iconDisabled]: disabled })}
              d="M128,30.364l20,20l-40,-0l20,-20Z"
            />
          </g>

          {/* DOWN button */}
          <g {...makeMouseHandlers(DirectionalPadAction.DOWN)} role="button">
            <path
              className={cx(buttonClasses.background, {
                [buttonClasses.backgroundDisabled]: disabled,
                [buttonClasses.backgroundPressed]: currentAction === DirectionalPadAction.DOWN,
              })}
              d="M93.172,176.764c20.74,14.771 48.795,14.771 69.535,0l42.723,42.723c-44.594,37.791 -110.372,37.794 -154.981,0l42.723,-42.723Z"
            />
            <path
              className={cx(buttonClasses.icon, { [buttonClasses.iconDisabled]: disabled })}
              d="M128,225.345l-20,-20l40,0l-20,20Z"
            />
          </g>
        </g>

        <g opacity={1}>
          {/* LEFT button */}
          <g {...makeMouseHandlers(DirectionalPadAction.LEFT)} role="button">
            <path
              className={cx(buttonClasses.background, {
                [buttonClasses.backgroundDisabled]: disabled,
                [buttonClasses.backgroundPressed]: currentAction === DirectionalPadAction.LEFT,
              })}
              d="M36.307,205.345c-37.793,-44.609 -37.791,-110.387 -0,-154.981l42.723,42.723c-14.771,20.74 -14.771,48.795 -0,69.535l-42.723,42.723Z"
            />
            <path
              className={cx(buttonClasses.icon, { [buttonClasses.iconDisabled]: disabled })}
              d="M30.449,127.854l20,-20l0,40l-20,-20Z"
            />
          </g>

          {/* RIGHT button */}
          <g {...makeMouseHandlers(DirectionalPadAction.RIGHT)} role="button">
            <path
              className={cx(buttonClasses.background, {
                [buttonClasses.backgroundDisabled]: disabled,
                [buttonClasses.backgroundPressed]: currentAction === DirectionalPadAction.RIGHT,
              })}
              d="M219.572,50.364c37.794,44.609 37.791,110.387 0.001,154.981l-42.724,-42.723c14.771,-20.74 14.771,-48.795 0,-69.535l42.723,-42.723Z"
            />
            <path
              className={cx(buttonClasses.icon, { [buttonClasses.iconDisabled]: disabled })}
              d="M225.43,127.854l-20,20l0,-40l20,20Z"
            />
          </g>
        </g>

        {/* STOP button */}
        {!disableStop && (
          <g {...makeMouseHandlers(DirectionalPadAction.STOP)} role="button">
            <circle
              className={cx(stopButtonClasses.background, {
                [stopButtonClasses.backgroundDisabled]: false,
              })}
              cx="128"
              cy="128"
              r="45"
            />
            <text
              x={128}
              dy={12}
              y={128}
              textAnchor="middle"
              className={cx(stopButtonClasses.text, {
                [stopButtonClasses.textDisabled]: false,
              })}
            >
              <tspan>STOP</tspan>
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default DirectionalPad;
