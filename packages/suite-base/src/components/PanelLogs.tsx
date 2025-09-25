// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import CloseIcon from "@mui/icons-material/Close";
import { List, ListItem, ListItemText, Typography, IconButton } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    background: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    maxHeight: 200,
    overflowY: "auto",
    padding: theme.spacing(1),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
}));

export type PanelLog = { timestamp: string; message: string; error?: Error };

export default function PanelLogs({
  logs,
  onClose,
}: {
  logs: PanelLog[];
  onClose: () => void;
}): React.ReactElement {
  const { classes } = useStyles();
  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography variant="subtitle2">Panel Logs ({logs.length})</Typography>
        <IconButton size="small" onClick={onClose} title="Close logs">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <List dense>
        {logs.length === 0 ? (
          <ListItem>
            <ListItemText
              primary="No logs yet."
              secondary="Errors and log messages will appear here."
            />
          </ListItem>
        ) : (
          logs.map((log, idx) => (
            <ListItem key={idx} alignItems="flex-start">
              <ListItemText
                primary={`[${log.error ? "ERROR" : "INFO"}] ${log.message}`}
                secondary={
                  <>
                    <Typography variant="caption" display="block">
                      {log.timestamp}
                    </Typography>
                    {log.error && (
                      <Typography
                        variant="caption"
                        color="error"
                        component="pre"
                        style={{ fontSize: "0.7em", marginTop: 4 }}
                      >
                        {log.error.stack ?? log.error.message}
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItem>
          ))
        )}
      </List>
    </div>
  );
}
