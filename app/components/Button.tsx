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
import { CSSProperties } from "react";

import ButtonBase, { Props as ButtonBaseProps } from "@foxglove/studio-base/components/ButtonBase";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export type Props = ButtonBaseProps & {
  tooltipProps?: Partial<React.ComponentProps<typeof Tooltip> & { alwaysShown?: false }>;
  style?: CSSProperties;
  isPrimary?: boolean;
};

// Wrapper for ButtonBase which uses our standard Tooltip styling.
export default function Button({
  tooltip,
  disabled = false,
  className,
  tooltipProps,
  onClick,
  onMouseUp,
  onMouseLeave,
  isPrimary = false,
  style = {},
  ...otherProps
}: Props): React.ReactElement {
  // overwrite the primary color for Studio
  // using `isPrimary` instead of `primary` now to prevent global UI changes until we are ready to migrate all styles
  const styleAlt = isPrimary ? { ...style, backgroundColor: colors.PRIMARY } : style;

  const eventHandlers = disabled ? {} : { onClick, onMouseUp, onMouseLeave };

  // replace disabled={true} with className="disabled" in order to allow tooltips on disabled buttons
  const newClassName = cx(className, { disabled });

  if (tooltip != undefined && tooltip.length > 0) {
    return (
      <Tooltip contents={tooltip} {...tooltipProps}>
        <ButtonBase style={styleAlt} {...otherProps} {...eventHandlers} className={newClassName} />
      </Tooltip>
    );
  }
  return (
    <ButtonBase style={styleAlt} {...otherProps} {...eventHandlers} className={newClassName} />
  );
}
