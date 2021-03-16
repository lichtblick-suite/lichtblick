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

import BaseTooltip from "@foxglove-studio/app/components/TooltipBase";

import styles from "./Tooltip.module.scss";

type BaseProps = React.ComponentProps<typeof BaseTooltip>;
type Props = Omit<BaseProps, "offset" | "fixed" | "contents"> & {
  fixed?: BaseProps["fixed"];
  offset?: BaseProps["offset"];
  contents?: BaseProps["contents"];
};

// Wrapper around BaseTooltip for consistent styling and behavior.
export default class Tooltip extends React.Component<Props> {
  render() {
    const {
      children,
      contents,
      placement = "auto",
      fixed = true,
      delay = 300,
      offset = { x: 0, y: 0 },
      ...otherProps
    } = this.props;

    if (!contents) {
      return children ?? ReactNull;
    }

    return (
      <BaseTooltip
        {...otherProps}
        placement={placement}
        fixed={fixed}
        delay={delay}
        offset={offset}
        contents={
          <div className={styles.tooltip}>
            {typeof contents === "function" ? contents() : contents}
          </div>
        }
        arrow={<div className={styles.arrow} />}
      >
        {children}
      </BaseTooltip>
    );
  }
}
