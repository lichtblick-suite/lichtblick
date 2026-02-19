// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Computer, Group } from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useState } from "react";

import { useStyles } from "@lichtblick/suite-base/components/NamespaceSelectionModal.style";
import { Namespace } from "@lichtblick/suite-base/types";

export interface NamespaceSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (namespace: Namespace) => void;
  files: File[];
}

export function NamespaceSelectionModal({
  open,
  onClose,
  onSelect,
  files,
}: NamespaceSelectionModalProps): React.JSX.Element {
  const { classes } = useStyles();
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace>("local");

  const handleSelect = () => {
    onSelect(selectedNamespace);
    onClose();
  };

  const fileNames = files.map((f) => f.name).join(", ");
  const fileCount = files.length;
  const hasExtensions = files.some((f) => f.name.endsWith(".foxe"));
  const hasLayouts = files.some((f) => f.name.endsWith(".json"));

  const getFileTypeDescription = () => {
    if (hasExtensions && hasLayouts) {
      return "extensions and layouts";
    } else if (hasExtensions) {
      return "extensions";
    } else if (hasLayouts) {
      return "layouts";
    }
    return "files";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Choose Installation Location</DialogTitle>
      <DialogContent>
        <Typography variant="body1" className={classes.fileTypeText}>
          You are about to install {fileCount} {getFileTypeDescription()}:
        </Typography>
        <Typography variant="body2" className={classes.fileNamesText}>
          {fileNames}
        </Typography>
        <Typography variant="body1" className={classes.questionText}>
          Where would you like to install these files?
        </Typography>
        <List>
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedNamespace === "local"}
              onClick={() => {
                setSelectedNamespace("local");
              }}
            >
              <ListItemIcon>
                <Computer />
              </ListItemIcon>
              <ListItemText
                primary="Local"
                secondary="Install only on this device. Files will be stored locally and won't be shared with your organization."
              />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedNamespace === "org"}
              onClick={() => {
                setSelectedNamespace("org");
              }}
            >
              <ListItemIcon>
                <Group />
              </ListItemIcon>
              <ListItemText
                primary="Organization"
                secondary="Install for your entire organization. Files will be shared with all members of your organization."
              />
            </ListItemButton>
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSelect} variant="contained">
          Install
        </Button>
      </DialogActions>
    </Dialog>
  );
}
