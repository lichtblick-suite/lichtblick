// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, PropsWithChildren, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles<StackProps>({ name: "FoxgloveStack" })((theme, props) => ({
  root: {
    display: props.inline === true ? "inline-flex" : "flex",
    flexDirection: props.direction,
    flex: props.flex,
    flexBasis: props.flexBasis,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    flexWrap: props.flexWrap,
    justifyContent: props.justifyContent,
    alignItems: props.alignItems,
    alignContent: props.alignContent,
    alignSelf: props.alignSelf,
    order: props.order,
    overflow: props.overflow,
    overflowX: props.overflowX,
    overflowY: props.overflowY,
    position: props.position,

    ...(props.zeroMinWidth === true && {
      minWidth: 0,
    }),
    ...(props.fullHeight === true && {
      height: "100%",
    }),
    ...(props.fullWidth === true && {
      width: "100%",
    }),
    ...(props.gap != undefined && {
      gap: theme.spacing(props.gap),
    }),
    ...(props.gapX != undefined && {
      rowGap: theme.spacing(props.gapX),
    }),
    ...(props.gapY != undefined && {
      columnGap: theme.spacing(props.gapY),
    }),
    ...(props.padding != undefined && {
      padding: theme.spacing(props.padding),
    }),
    ...(props.paddingX != undefined && {
      paddingLeft: theme.spacing(props.paddingX),
      paddingRight: theme.spacing(props.paddingX),
    }),
    ...(props.paddingY != undefined && {
      paddingTop: theme.spacing(props.paddingY),
      paddingBottom: theme.spacing(props.paddingY),
    }),
    ...(props.paddingTop != undefined && {
      paddingTop: theme.spacing(props.paddingTop),
    }),
    ...(props.paddingBottom != undefined && {
      paddingBottom: theme.spacing(props.paddingBottom),
    }),
    ...(props.paddingLeft != undefined && {
      paddingLeft: theme.spacing(props.paddingLeft),
    }),
    ...(props.paddingRight != undefined && {
      paddingRight: theme.spacing(props.paddingRight),
    }),
    ...(props.paddingBlock != undefined && {
      paddingBlock: theme.spacing(props.paddingBlock),
    }),
    ...(props.paddingBlockStart != undefined && {
      paddingBlockStart: theme.spacing(props.paddingBlockStart),
    }),
    ...(props.paddingBlockEnd != undefined && {
      paddingBlockEnd: theme.spacing(props.paddingBlockEnd),
    }),
    ...(props.paddingInline != undefined && {
      paddingInline: theme.spacing(props.paddingInline),
    }),
    ...(props.paddingInlineStart != undefined && {
      paddingInlineStart: theme.spacing(props.paddingInlineStart),
    }),
    ...(props.paddingInlineEnd != undefined && {
      paddingInlineEnd: theme.spacing(props.paddingInlineEnd),
    }),
  },
}));

export default forwardRef<HTMLDivElement, PropsWithChildren<StackProps>>(function Stack(
  props,
  ref,
): JSX.Element {
  const {
    alignItems,
    alignSelf,
    children,
    className,
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
    inline = false,
    justifyContent,
    order,
    overflow,
    overflowX,
    overflowY,
    padding,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingX,
    paddingY,
    paddingBlock,
    paddingBlockStart,
    paddingBlockEnd,
    paddingInline,
    paddingInlineStart,
    paddingInlineEnd,
    position,
    style,
    zeroMinWidth = false,
    ...rest
  } = props;

  const { classes, cx } = useStyles({
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
    inline,
    justifyContent,
    order,
    overflow,
    overflowX,
    overflowY,
    padding,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingX,
    paddingY,
    paddingBlock,
    paddingBlockStart,
    paddingBlockEnd,
    paddingInline,
    paddingInlineStart,
    paddingInlineEnd,
    position,
    zeroMinWidth,
  });

  return (
    <div ref={ref} className={cx(classes.root, className)} style={style} {...rest}>
      {children}
    </div>
  );
});

export type StackProps = {
  /** Class name applied to the root element. */
  className?: string;

  /**
   * Defines the `flex-direction` style property.
   * @default 'column'
   */
  direction?: CSSProperties["flexDirection"];

  /** Make stack 100% height. */
  fullHeight?: boolean;

  /** Make stack 100% height. */
  fullWidth?: boolean;

  /** Sets the display to inline-flex property. */
  inline?: boolean;

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

  /**
   * Defines the `padding-left` and `padding-right` style property using `theme.spacing` increments. */
  paddingX?: number;

  /** Defines the padding-top` and `padding-bottom` style property using `theme.spacing` increments. */
  paddingY?: number;

  /** Defines the vertical `padding-top` style property using `theme.spacing` increments. */
  paddingTop?: number;

  /** Defines the vertical `padding-bottom` style property using `theme.spacing` increments. */
  paddingBottom?: number;

  /** Defines the vertical `padding-left` style property using `theme.spacing` increments. */
  paddingLeft?: number;

  /** Defines the vertical `padding-right` style property using `theme.spacing` increments. */
  paddingRight?: number;

  /** Defines the vertical `padding-block` style property using `theme.spacing` increments. */
  paddingBlock?: number;

  /** Defines the vertical `padding-block-start` style property using `theme.spacing` increments. */
  paddingBlockStart?: number;

  /** Defines the vertical `padding-block-end` style property using `theme.spacing` increments. */
  paddingBlockEnd?: number;

  /** Defines the vertical `padding-inline` style property using `theme.spacing` increments. */
  paddingInline?: number;

  /** Defines the vertical `padding-inline-start` style property using `theme.spacing` increments. */
  paddingInlineStart?: number;

  /** Defines the vertical `padding-inline-end` style property using `theme.spacing` increments. */
  paddingInlineEnd?: number;

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

  /** Standard pointer events. */
  onPointerDown?: React.DOMAttributes<HTMLDivElement>["onPointerDown"];
  onPointerEnter?: React.DOMAttributes<HTMLDivElement>["onPointerEnter"];
  onPointerLeave?: React.DOMAttributes<HTMLDivElement>["onPointerLeave"];
  onPointerMove?: React.DOMAttributes<HTMLDivElement>["onPointerMove"];
  onPointerOver?: React.DOMAttributes<HTMLDivElement>["onPointerOver"];
  onPointerUp?: React.DOMAttributes<HTMLDivElement>["onPointerUp"];
};
