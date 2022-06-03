// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  styled as muiStyled,
} from "@mui/material";
import { useCallback, useState } from "react";

import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

const messageOrderLabel = {
  receiveTime: "Receive time",
  headerStamp: "Header stamp",
};

const StyledButton = muiStyled(Button)(({ theme }) => ({
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  minWidth: 140,
  justifyContent: "space-between",
}));

const messageOrderSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.playbackConfig.messageOrder ?? "receiveTime";

export default function MessageOrderControls(): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);
  const messageOrder = useCurrentLayoutSelector(messageOrderSelector);
  const { setPlaybackConfig } = useCurrentLayoutActions();

  const setMessageOrder = useCallback(
    (newMessageOrder: TimestampMethod) => {
      setPlaybackConfig({ messageOrder: newMessageOrder });
    },
    [setPlaybackConfig],
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <>
      <StyledButton
        id="message-order-button"
        aria-controls={open ? "message-order-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        disableRipple
        variant="contained"
        color="inherit"
        endIcon={<ArrowDropDownIcon />}
        title={`Order messages by ${messageOrderLabel[messageOrder].toLowerCase()}`}
      >
        {messageOrderLabel[messageOrder]}
      </StyledButton>
      <Menu
        id="message-order-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "message-order-button",
        }}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        {Object.entries(messageOrderLabel).map(([key, label]) => (
          <MenuItem
            key={key}
            selected={messageOrder === key}
            onClick={async () => setMessageOrder(key as TimestampMethod)}
          >
            {messageOrder === key && (
              <ListItemIcon>
                <CheckIcon fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText
              inset={messageOrder !== key}
              primary={label}
              primaryTypographyProps={{ variant: "body2" }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
