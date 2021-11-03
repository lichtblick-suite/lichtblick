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

import { makeStyles } from "@fluentui/react";
import cx from "classnames";
import { CSSProperties, MouseEventHandler } from "react";

const useStyles = makeStyles((theme) => ({
  flex: {
    display: "flex",
    flexDirection: "row",
    flex: "1 1 auto",

    "&::-webkit-scrollbar": {
      width: 4,
      height: 4,
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      background: theme.palette.blackTranslucent40,
      borderRadius: 2,
    },
  },
  reverse: {
    flexDirection: "row-reverse",
  },
  // when the theme changes dynamically, the main flex rule above moves later in the
  // generated style tag (order is not preserved), so we need the specificity to be higher
  // https://github.com/microsoft/fluentui/issues/20452
  col: { flexDirection: "column !important" },
  colReverse: { flexDirection: "column-reverse !important" },
  clip: {
    overflow: "hidden",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  start: {
    alignItems: "start",
  },
  end: {
    alignItems: "flex-end",
  },
  wrap: {
    flexWrap: "wrap",
  },
  scroll: {
    overflowY: "auto",
  },
  scrollX: {
    overflowX: "auto",
  },
}));

type Props = {
  // set to true to flex along column instead of row
  col?: boolean;
  row?: boolean;
  reverse?: boolean;
  // custom style
  style?: CSSProperties;
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

  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onMouseMove?: MouseEventHandler<HTMLDivElement>;
  // for storybook screenshots tests
  dataTest?: string;
};

const Flex = React.forwardRef((props: Props, ref: React.ForwardedRef<HTMLDivElement>) => {
  const classes = useStyles();
  const {
    col,
    row,
    reverse,
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
  if (col != undefined && col === row) {
    throw new Error("Flex col and row are mutually exclusive");
  }

  const directionClasses =
    col === true && reverse === true
      ? classes.colReverse
      : col === true
      ? classes.col
      : reverse === true
      ? classes.reverse
      : undefined;

  // toggle conditional classes based on props
  const conditionalClasses = {
    [classes.center]: center,
    [classes.start]: start,
    [classes.end]: end,
    [classes.wrap]: wrap,
    [classes.clip]: clip,
    [classes.scroll]: scroll,
    [classes.scrollX]: scrollX,
  };
  const combinedClasses = cx(classes.flex, directionClasses, conditionalClasses, className);

  return (
    <div
      ref={ref}
      data-test={dataTest}
      className={combinedClasses}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      {children}
    </div>
  );
});

Flex.displayName = "Flex";
export default Flex;
