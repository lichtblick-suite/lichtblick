// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Backdrop, Chip } from "@mui/material";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

type Props = {
  message?: string;
  isDragging: boolean;
  isOver: boolean;
  isValidTarget: boolean;
};

const useStyles = makeStyles()((theme) => ({
  backdrop: {
    position: "absolute",
    zIndex: theme.zIndex.modal - 1,
    alignItems: "flex-end",
    padding: theme.spacing(2),
  },
  invalidTarget: {
    backgroundColor: tc(theme.palette.background.default)
      .setAlpha(1 - theme.palette.action.disabledOpacity)
      .toRgbString(),
  },
  validTarget: {
    borderRadius: theme.shape.borderRadius,
    border: `2px solid ${theme.palette.primary.main}`,
    backgroundColor: tc(theme.palette.primary.main)
      .setAlpha(theme.palette.action.hoverOpacity)
      .toRgbString(),
  },
  chip: {
    boxShadow: theme.shadows[2],
    paddingInline: theme.spacing(2),
  },
}));

export function MessagePathDragOverlay(prop: Props): JSX.Element | ReactNull {
  const { isDragging, isOver, isValidTarget, message } = prop;
  const { classes, cx } = useStyles();

  if (!isDragging) {
    return ReactNull;
  }

  if (!isValidTarget) {
    return <Backdrop open className={cx(classes.backdrop, classes.invalidTarget)} />;
  }

  if (isOver) {
    return (
      <Backdrop open className={cx(classes.backdrop, classes.validTarget)}>
        {prop.message && (
          <Chip size="small" color="primary" label={message} className={classes.chip} />
        )}
      </Backdrop>
    );
  }

  return ReactNull;
}
