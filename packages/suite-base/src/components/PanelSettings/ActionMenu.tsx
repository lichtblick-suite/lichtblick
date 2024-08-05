// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MoreVertIcon from "@mui/icons-material/MoreVert";
import { IconButton, Menu, MenuItem, SvgIconProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  iconButtonSmall: {
    padding: theme.spacing(0.91125), // round out the overall height to 30px
    borderRadius: 0,
  },
}));

export function ActionMenu({
  allowShare,
  onReset,
  onShare,
  fontSize = "medium",
}: {
  allowShare: boolean;
  onReset: () => void;
  onShare: () => void;
  fontSize?: SvgIconProps["fontSize"];
}): JSX.Element {
  const { classes, cx } = useStyles();
  const [anchorEl, setAnchorEl] = React.useState<undefined | HTMLElement>();
  const { t } = useTranslation("panelSettings");
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <div>
      <IconButton
        className={cx({ [classes.iconButtonSmall]: fontSize === "small" })}
        id="basic-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <MoreVertIcon fontSize={fontSize} />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          disabled={!allowShare}
          onClick={() => {
            onShare();
            handleClose();
          }}
        >
          {t("importOrExportSettingsWithEllipsis")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onReset();
            handleClose();
          }}
        >
          {t("resetToDefaults")}
        </MenuItem>
      </Menu>
    </div>
  );
}
