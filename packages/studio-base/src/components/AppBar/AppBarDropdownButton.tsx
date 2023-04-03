// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChevronDown12Filled } from "@fluentui/react-icons";
import { ButtonBase } from "@mui/material";
import { forwardRef } from "react";
import tinycolor2 from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";

import { APP_BAR_FOREGROUND_COLOR, APP_BAR_PRIMARY_COLOR } from "./constants";

const useStyles = makeStyles()((theme) => ({
  textTruncate: {
    maxWidth: "18vw",
    overflow: "hidden",
  },
  layoutButton: {
    font: "inherit",
    fontSize: theme.typography.body2.fontSize,
    padding: theme.spacing(1.875, 2),
    gap: theme.spacing(0.5),
    borderRadius: 0,

    ":hover": {
      backgroundColor: tinycolor2(APP_BAR_FOREGROUND_COLOR).setAlpha(0.08).toString(),
    },
    "&.Mui-selected": {
      backgroundColor: APP_BAR_PRIMARY_COLOR,
    },
  },
}));

type Props = {
  title: string;
  selected: boolean;
  onClick: () => void;
};

/**
 * A button that can be used in the app bar to open a dropdown menu.
 */
const AppBarDropdownButton = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { title, onClick, selected } = props;
  const { classes, cx } = useStyles();

  return (
    <ButtonBase
      className={cx(classes.layoutButton, { "Mui-selected": selected })}
      aria-haspopup="true"
      onClick={onClick}
      ref={ref}
    >
      <div className={classes.textTruncate}>
        <TextMiddleTruncate text={title} />
      </div>
      <ChevronDown12Filled />
    </ButtonBase>
  );
});
AppBarDropdownButton.displayName = "AppBarDropdownButton";

export { AppBarDropdownButton };
