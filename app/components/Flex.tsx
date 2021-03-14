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

import styles from "./Flex.module.scss";

type Props = {
  // set to true to flex along column instead of row
  col?: boolean;
  row?: boolean;
  reverse?: boolean;
  // pass a number for pixels or string percentage
  // and the flex container will be fixed to this amount
  fixed?: number | string;
  // custom style
  style?: any;
  // custom class names
  className?: string;
  // set to true to center content horizontally and vertically
  center?: boolean;
  start?: boolean;
  end?: boolean;
  wrap?: boolean;
  clip?: boolean;

  // set to true to scroll content vertically
  scroll?: boolean;
  scrollX?: boolean;
  children?: React.ReactNode;

  onClick?: (arg0: MouseEvent) => void;
  onMouseEnter?: (arg0: MouseEvent) => void;
  onMouseLeave?: (arg0: MouseEvent) => void;
  onMouseMove?: (arg0: MouseEvent) => void;
  // for storybook screenshots tests
  dataTest?: string;
};

const Flex = (props: Props) => {
  const {
    col,
    row,
    reverse,
    fixed,
    style,
    className,
    center,
    start,
    end,
    wrap,
    clip,
    scroll,
    scrollX,
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    dataTest,
  } = props;
  if (col != null && col === row) {
    throw new Error("Flex col and row are mutually exclusive");
  }

  // toggle conditional classes based on props
  const conditionalClasses = {
    [styles.col]: col,
    [styles.reverse]: reverse,
    [styles.center]: center,
    [styles.start]: start,
    [styles.end]: end,
    [styles.wrap]: wrap,
    [styles.clip]: clip,
    [styles.scroll]: scroll,
    [styles.scrollX]: scrollX,
  };
  const combinedClasses = cx(styles.flex, conditionalClasses, className);

  // support both numeric and string (percentage) flex directives
  const amount = typeof fixed === "number" ? `${fixed}px` : fixed;
  const flexStyle = amount ? { flex: `0 0 ${amount}` } : {};
  // only copy combine flex & custom style if we were passed custom style
  const fullStyle = style ? { ...flexStyle, ...style } : flexStyle;
  return (
    <div
      data-test={dataTest}
      className={combinedClasses}
      style={fullStyle}
      onClick={onClick as any}
      onMouseEnter={onMouseEnter as any}
      onMouseLeave={onMouseLeave as any}
      onMouseMove={onMouseMove as any}
    >
      {children}
    </div>
  );
};

Flex.displayName = "Flex";
export default Flex;
