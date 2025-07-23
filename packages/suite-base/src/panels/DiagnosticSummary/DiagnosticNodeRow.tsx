// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IconButton, ListItem, ListItemButton, ListItemText } from "@mui/material";
import { useCallback } from "react";

import PublishPointIcon from "@lichtblick/suite-base/components/PublishPointIcon";
import { useStyles } from "@lichtblick/suite-base/panels/DiagnosticSummary/DiagnosticSummary.style";
import { MESSAGE_COLORS } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import { NodeRowProps } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";

function DiagnosticNodeRow(props: Readonly<NodeRowProps>) {
  const { info, isPinned, onClick, onClickPin } = props;
  const { classes } = useStyles();

  const handleClick = useCallback(() => {
    onClick(info);
  }, [onClick, info]);

  const handleClickPin = useCallback(() => {
    onClickPin(info);
  }, [onClickPin, info]);

  return (
    <ListItem dense disablePadding data-testid="diagnostic-row">
      <ListItemButton
        className={classes.listItemButton}
        disableGutters
        onClick={handleClick}
        data-testid="diagnostic-row-button"
      >
        <IconButton
          size="small"
          onClick={(event) => {
            handleClickPin();
            event.stopPropagation();
          }}
          style={isPinned ? { visibility: "visible" } : undefined}
          data-testid="diagnostic-row-icon"
        >
          <PublishPointIcon fontSize="small" color={isPinned ? "inherit" : "disabled"} />
        </IconButton>
        <ListItemText
          primary={info.displayName}
          secondary={info.status.message}
          slotProps={{
            secondary: {
              color: MESSAGE_COLORS[info.status.level],
            },
          }}
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        />
      </ListItemButton>
    </ListItem>
  );
}

export default React.memo(DiagnosticNodeRow);
