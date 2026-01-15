// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
              d={svgPathsEnabled.up}
            />
            <path className={cx(classes.buttonIcon, { disabled })} d={svgPathsDisabled.up} />
          </g>

          {/* DOWN button */}
          <g {...makeMouseHandlers(DirectionalPadAction.DOWN)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.DOWN,
                disabled,
              })}
              d={svgPathsEnabled.down}
            />
            <path className={cx(classes.buttonIcon, { disabled })} d={svgPathsDisabled.down} />
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
              d={svgPathsEnabled.left}
            />
            <path className={cx(classes.buttonIcon, { disabled })} d={svgPathsDisabled.left} />
          </g>

          {/* RIGHT button */}
          <g {...makeMouseHandlers(DirectionalPadAction.RIGHT)} role="button">
            <path
              className={cx(classes.button, {
                active: currentAction === DirectionalPadAction.RIGHT,
                disabled,
              })}
              d={svgPathsEnabled.right}
            />
            <path className={cx(classes.buttonIcon, { disabled })} d={svgPathsDisabled.right} />
          </g>
        </g>
      </svg>
    </Stack>
  );
}

export default DirectionalPad;
