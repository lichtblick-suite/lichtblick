// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

type TreeClasses = "dragHandle" | "isDragging" | "selected";

/* eslint-disable tss-unused-classes/unused-classes */
export const useTopicListStyles = makeStyles<void, TreeClasses>()((theme, _, classes) => ({
  root: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    containerType: "inline-size",
  },
  filterBar: {
    top: 0,
    zIndex: theme.zIndex.appBar,
    padding: theme.spacing(0.5),
    position: "sticky",
    backgroundColor: theme.palette.background.paper,
  },
  filterStartAdornment: {
    display: "flex",
  },
  skeletonText: {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
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

    [`&.${classes.selected}`]: {
      // use opaque color for better drag preview
      backgroundColor: tc
        .mix(
          theme.palette.background.paper,
          theme.palette.primary.main,
          100 * theme.palette.action.selectedOpacity,
        )
        .toRgbString(),
    },
    [`&.${classes.isDragging}:active`]: {
      // use opaque color for better drag preview
      backgroundColor: tc
        .mix(
          theme.palette.background.paper,
          theme.palette.primary.main,
          100 * theme.palette.action.hoverOpacity,
        )
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
  selected: {},

  countBadge: {
    padding: theme.spacing(0.25, 0.5),
    borderRadius: "1em",
    minWidth: theme.spacing(2),
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    fontWeight: "bold",
    fontSize: theme.typography.caption.fontSize,
    textAlign: "center",
    marginLeft: theme.spacing(-1),
  },

  textContent: {
    maxWidth: "100%",
    userSelect: "text",
  },
}));
/* eslint-enable tss-unused-classes/unused-classes */
