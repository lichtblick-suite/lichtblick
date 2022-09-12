// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Button, styled as muiStyled, Menu, MenuItem } from "@mui/material";
import { MouseEvent, useState, useCallback } from "react";

import { Topic } from "@foxglove/studio";
import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";

type TopicDropdownProps = {
  topics: Topic[];
  currentTopic?: Topic["name"];
  onChange: (topic: Topic["name"]) => void;
};

const StyledButton = muiStyled(Button)(({ theme }) => ({
  backgroundColor: "transparent",
  paddingTop: theme.spacing(0.375),
  paddingBottom: theme.spacing(0.375),
  color: theme.palette.text.secondary,
  overflow: "hidden",

  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
}));

export function TopicDropdown(props: TopicDropdownProps): JSX.Element {
  const { topics, currentTopic, onChange } = props;
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = useCallback(() => {
    setAnchorEl(undefined);
  }, []);

  const handleMenuClick = useCallback(
    (value: Topic["name"]) => {
      onChange(value);
      handleClose();
    },
    [handleClose, onChange],
  );

  return (
    <>
      <StyledButton
        size="small"
        id="topic-button"
        disableRipple
        aria-controls={open ? "topic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleButtonClick}
        endIcon={<ArrowDropDownIcon />}
        color="inherit"
        title={
          currentTopic
            ? currentTopic
            : topics.length === 0
            ? "No camera topics"
            : "Select a camera topic"
        }
      >
        {currentTopic ? (
          <TextMiddleTruncate
            endTextLength={10}
            text={currentTopic}
            style={{ overflow: "hidden" }}
          />
        ) : topics.length === 0 ? (
          "No camera topics"
        ) : (
          "Select a camera topic"
        )}
      </StyledButton>
      <Menu
        id="topic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "topic-button",
          dense: true,
        }}
      >
        {topics.length === 0 && <MenuItem disabled>No topics</MenuItem>}
        {topics.map((topic) => (
          <MenuItem
            key={topic.name}
            selected={topic.name === currentTopic}
            onClick={() => handleMenuClick(topic.name)}
          >
            {topic.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
