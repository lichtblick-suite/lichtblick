// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import cx from "classnames";
import { CSSProperties, useCallback } from "react";

import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { LegacyButton } from "./LegacyStyledComponents";

export type Props = {
  tooltipProps?: Partial<React.ComponentProps<typeof Tooltip> & { alwaysShown?: false }>;
  style?: CSSProperties;
  isPrimary?: boolean;
  id?: string;
  small?: boolean;
  large?: boolean;
  primary?: boolean;
  warning?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  onMouseUp?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  tooltip?: string;
  innerRef?: React.Ref<HTMLButtonElement>;
};

// Wrapper for ButtonBase which uses our standard Tooltip styling.
export default function Button({
  children,
  id,
  tooltip,
  disabled = false,
  className,
  tooltipProps,
  onFocus,
  onClick: click,
  onMouseUp: mouseUp,
  onMouseLeave: mouseLeave,
  isPrimary = false,
  style = {},
  small,
  large,
  primary,
  danger,
  warning,
  innerRef,
}: Props): React.ReactElement {
  const onMouseUp = useCallback(
    (e: React.SyntheticEvent<HTMLButtonElement>) => {
      if (mouseUp) {
        mouseUp(e);
      }
    },
    [mouseUp],
  );

  const onMouseLeave = useCallback(
    (e: React.SyntheticEvent<HTMLButtonElement>) => {
      if (mouseLeave) {
        mouseLeave(e);
      }
    },
    [mouseLeave],
  );

  const onClick = useCallback(
    (e: React.SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (click) {
        click(e);
      }
    },
    [click],
  );

  const eventHandlers = disabled ? {} : { onClick, onMouseUp, onMouseLeave };

  // overwrite the primary color for Studio
  // using `isPrimary` instead of `primary` now to prevent global UI changes until we are ready to migrate all styles
  const styles = isPrimary ? { ...style, backgroundColor: colors.PRIMARY } : style;

  const classes = cx("button", className ?? "", {
    // replace disabled={true} with className="disabled" in order to allow
    // tooltips on disabled buttons
    disabled,
    // support some bulma classes to be supplied in consumer either through
    // bulma or custom classes these provide backwards compatibility with Studio
    "is-small": small,
    "is-large": large,
    "is-primary": primary,
    "is-warning": warning,
    "is-danger": danger,
  });

  // Initialize the button
  const button = (
    <LegacyButton
      type="button"
      className={classes}
      id={id}
      onFocus={onFocus}
      {...eventHandlers}
      style={{ position: "relative", ...styles }}
      disabled={disabled}
      ref={innerRef}
    >
      {children}
    </LegacyButton>
  );

  // Wrap the button in a tooltip
  if (tooltip != undefined && tooltip.length > 0) {
    return (
      <Tooltip contents={tooltip} {...tooltipProps}>
        {button}
      </Tooltip>
    );
  }

  return button;
}
