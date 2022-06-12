// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { styled as muiStyled, Theme, useTheme } from "@mui/material";
import cx from "classnames";
import { ElementType, CSSProperties, PropsWithChildren, forwardRef } from "react";

const StackRoot = muiStyled("div", {
  name: "FoxgloveStack",
  slot: "Root",
  skipSx: true,
})(({ theme, ownerState }: { theme: Theme; ownerState: StackProps }) => ({
  display: "flex",
  flexDirection: ownerState.direction,
  flex: ownerState.flex,
  flexBasis: ownerState.flexBasis,
  flexShrink: ownerState.flexShrink,
  flexGrow: ownerState.flexGrow,
  flexWrap: ownerState.flexWrap,
  justifyContent: ownerState.justifyContent,
  alignItems: ownerState.alignItems,
  alignContent: ownerState.alignContent,
  alignSelf: ownerState.alignSelf,
  order: ownerState.order,
  overflow: ownerState.overflow,
  position: ownerState.position,

  ...(ownerState.overflowX != undefined && {
    overflowX: ownerState.overflowX,
  }),
  ...(ownerState.overflowY != undefined && {
    overflowY: ownerState.overflowY,
  }),
  ...(ownerState.zeroMinWidth === true && {
    minWidth: 0,
  }),
  ...(ownerState.fullHeight === true && {
    height: "100%",
  }),
  ...(ownerState.fullWidth === true && {
    width: "100%",
  }),
  ...(ownerState.gap != undefined && {
    gap: theme.spacing(ownerState.gap),
  }),
  ...(ownerState.gapX != undefined && {
    rowGap: theme.spacing(ownerState.gapX),
  }),
  ...(ownerState.gapY != undefined && {
    columnGap: theme.spacing(ownerState.gapY),
  }),
  ...(ownerState.padding != undefined && {
    padding: theme.spacing(ownerState.padding),
  }),
  ...(ownerState.paddingX != undefined && {
    paddingLeft: theme.spacing(ownerState.paddingX),
    paddingRight: theme.spacing(ownerState.paddingX),
  }),
  ...(ownerState.paddingY != undefined && {
    paddingTop: theme.spacing(ownerState.paddingY),
    paddingBottom: theme.spacing(ownerState.paddingY),
  }),
  ...(ownerState.paddingTop != undefined && {
    paddingTop: theme.spacing(ownerState.paddingTop),
  }),
  ...(ownerState.paddingBottom != undefined && {
    paddingBottom: theme.spacing(ownerState.paddingBottom),
  }),
  ...(ownerState.paddingLeft != undefined && {
    paddingLeft: theme.spacing(ownerState.paddingLeft),
  }),
  ...(ownerState.paddingRight != undefined && {
    paddingRight: theme.spacing(ownerState.paddingRight),
  }),
}));

export default forwardRef<HTMLDivElement, PropsWithChildren<StackProps>>(function Stack(
  props,
  ref,
): JSX.Element {
  const theme = useTheme();

  const {
    alignItems,
    alignSelf,
    className,
    component = "div",
    direction = "column",
    flex,
    flexBasis,
    flexGrow,
    flexShrink,
    flexWrap,
    fullHeight = false,
    fullWidth = false,
    gap,
    gapX,
    gapY,
    justifyContent,
    order,
    overflow,
    overflowX,
    overflowY,
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    position,
    style,
    zeroMinWidth = false,
    ...other
  } = props;

  const ownerState = {
    ...props,
    alignItems,
    alignSelf,
    direction,
    flex,
    flexBasis,
    flexGrow,
    flexShrink,
    flexWrap,
    fullHeight,
    fullWidth,
    gap,
    gapX,
    gapY,
    justifyContent,
    order,
    overflow,
    overflowX,
    overflowY,
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    position,
    zeroMinWidth,
  };

  return (
    <StackRoot
      as={component}
      ref={ref}
      className={cx("FoxgloveStack-root", className)} // add className for ergonimic styling purposes
      ownerState={ownerState}
      theme={theme}
      style={style}
      {...other}
    />
  );
});

export type StackProps = {
  /** Override or extend the styles applied to the component. */
  classes?: {
    root: string;
  };

  /** Class name applied to the root element. */
  className?: string;

  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component?: ElementType;

  /**
   * Defines the `flex-direction` style property.
   * @default 'column'
   */
  direction?: CSSProperties["flexDirection"];

  /** Make stack 100% height. */
  fullHeight?: boolean;

  /** Make stack 100% height. */
  fullWidth?: boolean;

  /** Defines the `justify-content` style property. */
  justifyContent?: CSSProperties["justifyContent"];

  /** Defines the `align-items` style property. */
  alignItems?: CSSProperties["alignItems"];

  /** Defines the `align-content` style property. */
  alignContent?: CSSProperties["alignContent"];

  /** Defines the `align-self` style property. */
  alignSelf?: CSSProperties["alignSelf"];

  /** Defines the `gap` style property using `theme.spacing` increments. */
  gap?: number;

  /** Defines the `rowGap` style property using `theme.spacing` increments. */
  gapX?: number;

  /** Defines the `columnGap` style property using `theme.spacing` increments. */
  gapY?: number;

  /** Defines the `overflow` style property. */
  overflow?: CSSProperties["overflow"];

  /** Defines the `overflow-x` style property. */
  overflowX?: CSSProperties["overflowX"];

  /** Defines the `overflow-y` style property. */
  overflowY?: CSSProperties["overflowY"];

  /** Defines the `padding` style property using `theme.spacing` increments. */
  padding?: number;

  /** Defines the horizontal `padding` style property using `theme.spacing` increments. */
  paddingX?: number;

  /** Defines the vertical `padding` style property using `theme.spacing` increments. */
  paddingY?: number;

  /** Defines the vertical `padding-top` style property using `theme.spacing` increments. */
  paddingTop?: number;

  /** Defines the vertical `padding-bottom` style property using `theme.spacing` increments. */
  paddingBottom?: number;

  /** Defines the vertical `padding-left` style property using `theme.spacing` increments. */
  paddingLeft?: number;

  /** Defines the vertical `padding-right` style property using `theme.spacing` increments. */
  paddingRight?: number;

  /** Defines the `position` style property. */
  position?: CSSProperties["position"];

  /** Defines the `flex` style property. */
  flex?: CSSProperties["flex"];

  /** Defines the `flex-grow` style property. */
  flexGrow?: CSSProperties["flexGrow"];

  /** Defines the `flex-shrink` style property. */
  flexShrink?: CSSProperties["flexShrink"];

  /** Defines the `flex-basis` style property. */
  flexBasis?: CSSProperties["flexBasis"];

  /** Defines the `flex-wrap` style property. */
  flexWrap?: CSSProperties["flexWrap"];

  /** Defines the `order` property. */
  order?: CSSProperties["order"];

  /** Sets the minWidth to zero */
  zeroMinWidth?: boolean;

  /** CSS styles to apply to the component. */
  style?: CSSProperties;
};
