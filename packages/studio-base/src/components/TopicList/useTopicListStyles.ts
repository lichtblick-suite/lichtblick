// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

type TreeClasses = "dragHandle" | "isDragging";

/* eslint-disable tss-unused-classes/unused-classes */
export const useTopicListStyles = makeStyles<void, TreeClasses>()((theme, _, classes) => ({
  root: {
    containerType: "inline-size",
  },
  aliasedTopicName: {
    color: theme.palette.primary.main,
    display: "block",
    textAlign: "start",
  },
  row: {
    whiteSpace: "nowrap",
    boxSizing: "border-box",

    [`:not(:hover) .${classes.dragHandle}`]: {
      visibility: "hidden",
    },
    ":focus": {
      outline: `1px solid ${theme.palette.primary.main}`,
      outlineOffset: -1,

      [`.${classes.dragHandle}`]: {
        visibility: "visible",
      },
    },
    position: "relative",
    display: "flex",
    alignItems: "center",
    height: "100%",
    gap: theme.spacing(0.75),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(0.75),
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.action.selected}`,

    [`&.${classes.isDragging}:active`]: {
      backgroundColor: tc(theme.palette.primary.main)
        .setAlpha(theme.palette.action.hoverOpacity)
        .toRgbString(),
      outline: `1px solid ${theme.palette.primary.main}`,
      outlineOffset: -1,
      borderRadius: theme.shape.borderRadius,
    },
  },
  fieldRow: {
    borderTop: `1px solid ${theme.palette.background.paper}`,
    backgroundColor: theme.palette.action.hover,
    // paddingLeft: theme.spacing(3),
  },
  dragHandle: {
    opacity: 0.6,
    cursor: "grab",
  },
  isDragging: {},
}));
/* eslint-enable tss-unused-classes/unused-classes */
