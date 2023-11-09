// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { badgeClasses } from "@mui/material";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

type TreeClasses = "dragHandle" | "row" | "isDragging" | "selected";

export const useTopicListStyles = makeStyles<void, TreeClasses>()((theme, _, classes) => ({
  isDragging: {},
  selected: {},
  row: {
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    position: "relative",
    height: "100%",
    backgroundColor: theme.palette.background.paper,
    gap: theme.spacing(0.5),
    paddingInline: theme.spacing(1, 0.75),
    borderTop: `1px solid ${theme.palette.action.selected}`,
    boxShadow: `0 1px 0 0 ${theme.palette.action.selected}`,
    userSelect: "none",

    [`:not(:hover) .${classes.dragHandle}`]: {
      visibility: "hidden",
    },
    [`&.${classes.selected}, &.${classes.isDragging}:active`]: {
      // use opaque color for better drag preview
      backgroundColor: tc
        .mix(
          theme.palette.background.paper,
          theme.palette.primary.main,
          100 * theme.palette.action.selectedOpacity,
        )
        .toString(),

      ...(theme.palette.mode === "dark" && {
        ":after": {
          content: "''",
          position: "absolute",
          inset: "-1px 0 -1px 0",
          border: `1px solid ${theme.palette.primary.main}`,
        },
        [`& + .${classes.row}`]: {
          borderTop: `1px solid ${theme.palette.primary.main}`,
        },
      }),
    },
  },
  dragHandle: {
    opacity: 0.6,
    display: "flex",

    [`.${classes.selected} &`]: {
      color: theme.palette.primary.main,
      opacity: 1,
    },
    [`@container (max-width: 280px)`]: {
      display: "none",
    },
  },
  // tss-unused-classes only looks within the same file to determine if classes are used. These ones
  // are used in other files.
  /* eslint-disable tss-unused-classes/unused-classes */
  fieldRow: {
    borderTop: `1px solid ${theme.palette.background.paper}`,
    backgroundColor: theme.palette.action.hover,
  },
  countBadge: {
    marginLeft: theme.spacing(-0.5),

    [`.${badgeClasses.badge}`]: {
      position: "relative",
      transform: "none",
    },
  },
  textContent: {
    maxWidth: "100%",
  },
  aliasedTopicName: {
    color: theme.palette.primary.main,
    display: "block",
    textAlign: "start",
  },
  /* eslint-enable tss-unused-classes/unused-classes */
}));
