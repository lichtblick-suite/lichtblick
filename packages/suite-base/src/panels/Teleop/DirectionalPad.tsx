// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useState } from "react";

import Stack from "@lichtblick/suite-base/components/Stack";
import { svgPathsDisabled, svgPathsEnabled } from "@lichtblick/suite-base/panels/Teleop/constants";
import {
  DirectionalPadAction,
  DirectionalPadProps,
} from "@lichtblick/suite-base/panels/Teleop/types";

import { useStyles } from "./DirectionalPad.style";

function DirectionalPad(props: Readonly<DirectionalPadProps>): React.JSX.Element {
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

  const handleStopClick = useCallback(() => {
    setCurrentAction(DirectionalPadAction.STOP);
    onAction?.(DirectionalPadAction.STOP);
    // Immediately clear after stop
    setTimeout(() => {
      setCurrentAction(undefined);
      onAction?.();
    }, 100);
  }, [onAction]);

  const makeMouseHandlers = (action: DirectionalPadAction) =>
    disabled
      ? undefined
      : {
          onMouseDown: () => {
            handleMouseDown(action);
          },
          onMouseUp: () => {
            handleMouseUp();
          },
          onMouseLeave: () => {
            handleMouseUp();
          },
        };


  return (
    <Stack
      justifyContent="center"
      alignItems="center"
      fullWidth
      fullHeight
      style={{ userSelect: "none", position: "relative" }}
    >
      <svg className={classes.svg} viewBox="0 0 256 256" style={{ width: "100%", height: "100%" }}>
        {/* Rotation buttons - Upper corners */}
        {/* Upper Left Rotation */}
        <g {...makeMouseHandlers(DirectionalPadAction.ROTATE_LEFT)} role="button">
          <circle
            className={cx(classes.button, {
              active: currentAction === DirectionalPadAction.ROTATE_LEFT,
              disabled,
            })}
            cx="50"
            cy="50"
            r="22"
          />
          <text
            x="50"
            y="50"
            className={cx(classes.buttonIcon, { disabled })}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="bold"
          >
            CCW
          </text>
        </g>

        {/* Upper Right Rotation */}
        <g {...makeMouseHandlers(DirectionalPadAction.ROTATE_RIGHT)} role="button">
          <circle
            className={cx(classes.button, {
              active: currentAction === DirectionalPadAction.ROTATE_RIGHT,
              disabled,
            })}
            cx="206"
            cy="50"
            r="22"
          />
          <text
            x="206"
            y="50"
            className={cx(classes.buttonIcon, { disabled })}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="bold"
          >
            CW
          </text>
        </g>

        {/* Main directional pad - moved closer together */}
        <g opacity={1} transform="translate(128, 128)">
          {/* UP button - closer to center */}
          <g {...makeMouseHandlers(DirectionalPadAction.UP)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.UP,
                disabled,
              })}
              d={svgPathsEnabled.up}
              transform="scale(0.7) translate(-128, -128)"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d={svgPathsDisabled.up}
              transform="scale(0.7) translate(-128, -128)"
            />
          </g>

          {/* DOWN button - closer to center */}
          <g {...makeMouseHandlers(DirectionalPadAction.DOWN)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.DOWN,
                disabled,
              })}
              d={svgPathsEnabled.down}
              transform="scale(0.7) translate(-128, -128)"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d={svgPathsDisabled.down}
              transform="scale(0.7) translate(-128, -128)"
            />
          </g>

          {/* LEFT button - closer to center */}
          <g {...makeMouseHandlers(DirectionalPadAction.LEFT)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.LEFT,
                disabled,
              })}
              d={svgPathsEnabled.left}
              transform="scale(0.7) translate(-128, -128)"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d={svgPathsDisabled.left}
              transform="scale(0.7) translate(-128, -128)"
            />
          </g>

          {/* RIGHT button - closer to center */}
          <g {...makeMouseHandlers(DirectionalPadAction.RIGHT)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.RIGHT,
                disabled,
              })}
              d={svgPathsEnabled.right}
              transform="scale(0.7) translate(-128, -128)"
            />
            <path
              className={cx(classes.buttonIcon, { disabled })}
              d={svgPathsDisabled.right}
              transform="scale(0.7) translate(-128, -128)"
            />
          </g>

          {/* STOP button - Center */}
          <g
            onClick={handleStopClick}
            role="button"
            style={{ cursor: disabled ? "auto" : "pointer" }}
          >
            <circle
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.STOP,
                disabled,
              })}
              cx="0"
              cy="0"
              r="20"
            />
            <text
              x="0"
              y="0"
              className={cx(classes.buttonIcon, { disabled })}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="bold"
            >
              STOP
            </text>
          </g>
        </g>
      </svg>
    </Stack>
  );
}

export default DirectionalPad;
