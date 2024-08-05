// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import {
  IconButton,
  InputBase,
  ListItem,
  ListItemButton,
  ListItemText,
  inputBaseClasses,
  listItemSecondaryActionClasses,
} from "@mui/material";
import { ChangeEventHandler, FocusEventHandler, KeyboardEvent, useCallback, useState } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  input: {
    font: "inherit",
    padding: theme.spacing(1, 6, 1, 2),
    flexGrow: 1,
    overflow: "hidden",

    [`.${inputBaseClasses.input}`]: {
      padding: 0,
    },
  },
  listItem: {
    [`:not(:hover) .${listItemSecondaryActionClasses.root}`]: {
      visibility: "hidden",
    },
    [`:focus-within`]: {
      backgroundColor: theme.palette.action.selected,
    },
  },
}));

export function ScriptListItem({
  onClick,
  onDelete,
  onRename,
  title,
  selected,
}: {
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  title: string;
  selected?: boolean;
}): JSX.Element {
  const { classes } = useStyles();
  const [label, setLabel] = useState(title);
  const [editMode, setEditMode] = useState(false);

  const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    const name = event.target.value;
    setLabel(name);
  }, []);

  const onDoubleClick = useCallback(() => {
    setEditMode(true);
  }, []);

  const onFocus: FocusEventHandler<HTMLInputElement> = useCallback((event) => {
    event.target.select();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (label === "") {
        return;
      }
      if (event.key === "Escape") {
        setLabel(title);
        setEditMode(false);
      } else if (event.key === "Enter") {
        setEditMode(false);
        onRename(label);
      }
    },
    [label, onRename, title],
  );

  const onBlur = useCallback(() => {
    if (label !== "") {
      setEditMode(false);
      onRename(label);

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [label, onRename]);

  const onButtonKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Enter") {
      setEditMode(true);
    }
  }, []);

  return (
    <ListItem
      className={classes.listItem}
      disablePadding
      secondaryAction={
        <>
          {!editMode && (
            <IconButton
              size="small"
              aria-title="rename"
              title="Rename"
              onClick={() => {
                setEditMode(true);
              }}
            >
              <Edit20Regular />
            </IconButton>
          )}
          <IconButton
            size="small"
            aria-title="delete"
            title="Delete"
            color="error"
            onClick={onDelete}
          >
            <Delete20Regular />
          </IconButton>
        </>
      }
    >
      {editMode ? (
        <ListItemText primaryTypographyProps={{ variant: "body2" }}>
          <InputBase
            autoFocus
            fullWidth
            onBlur={onBlur}
            onChange={onChange}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            value={label}
            className={classes.input}
          />
        </ListItemText>
      ) : (
        <ListItemButton
          selected={selected}
          onClick={onClick}
          onKeyDown={onButtonKeyDown}
          onDoubleClick={onDoubleClick}
        >
          <ListItemText
            primary={title}
            primaryTypographyProps={{ variant: "body2", noWrap: true }}
          />
        </ListItemButton>
      )}
    </ListItem>
  );
}
