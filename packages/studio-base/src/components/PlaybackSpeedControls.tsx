// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";

const SPEED_OPTIONS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 0.8, 1, 2, 3, 5];

const formatSpeed = (val: number) => `${val < 0.1 ? val.toFixed(2) : val}×`;

const configSpeedSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.playbackConfig.speed;

const useStyles = makeStyles()((theme) => ({
  button: {
    padding: theme.spacing(0.625, 0.5),
    backgroundColor: "transparent",

    ":hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

export default function PlaybackSpeedControls(): JSX.Element {
  const { classes } = useStyles();
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);
  const configSpeed = useCurrentLayoutSelector(configSpeedSelector);
  const speed = useMessagePipeline(
    useCallback(({ playerState }) => playerState.activeData?.speed, []),
  );
  const setPlaybackSpeed = useMessagePipeline(useCallback((state) => state.setPlaybackSpeed, []));
  const { setPlaybackConfig } = useCurrentLayoutActions();
  const setSpeed = useCallback(
    (newSpeed: number) => {
      setPlaybackConfig({ speed: newSpeed });
      setPlaybackSpeed?.(newSpeed);
    },
    [setPlaybackConfig, setPlaybackSpeed],
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  // Set the speed to the speed that we got from the config whenever we get a new Player.
  useEffect(() => {
    if (configSpeed != undefined) {
      setPlaybackSpeed?.(configSpeed);
    }
  }, [configSpeed, setPlaybackSpeed]);

  const displayedSpeed = speed ?? configSpeed;

  return (
    <>
      <Button
        className={classes.button}
        id="playback-speed-button"
        aria-controls={open ? "playback-speed-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        data-testid="PlaybackSpeedControls-Dropdown"
        disabled={setPlaybackSpeed == undefined}
        disableRipple
        variant="contained"
        color="inherit"
        endIcon={<ArrowDropDownIcon />}
      >
        {displayedSpeed == undefined ? "–" : formatSpeed(displayedSpeed)}
      </Button>
      <Menu
        id="playback-speed-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "playback-speed-button",
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
        {SPEED_OPTIONS.map((option) => (
          <MenuItem
            selected={displayedSpeed === option}
            key={option}
            onClick={() => {
              setSpeed(option);
              handleClose();
            }}
          >
            {displayedSpeed === option && (
              <ListItemIcon>
                <CheckIcon fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText
              inset={displayedSpeed !== option}
              primary={formatSpeed(option)}
              primaryTypographyProps={{ variant: "body2" }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
