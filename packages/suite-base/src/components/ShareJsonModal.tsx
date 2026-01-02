// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ArrowDownload20Filled, Delete20Regular } from "@fluentui/react-icons";
import CloseIcon from "@mui/icons-material/Close";
import {
  Button,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  TextField,
  outlinedInputClasses,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import CopyButton from "@lichtblick/suite-base/components/CopyButton";
import HoverableIconButton from "@lichtblick/suite-base/components/HoverableIconButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import { downloadTextFile } from "@lichtblick/suite-base/util/download";
import { customTypography } from "@lichtblick/theme";

export type ShareJsonModalProps = {
  onRequestClose: () => void;
  onChange: (value: unknown) => void;
  initialValue: unknown;
  title: string;
};

const useStyles = makeStyles()((theme) => ({
  textarea: {
    [`.${outlinedInputClasses.root}`]: {
      backgroundColor: theme.palette.action.hover,
      fontFamily: customTypography.fontMonospace,
      maxHeight: "60vh",
      overflowY: "auto",
      padding: theme.spacing(0.25),
    },
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
}));

export function ShareJsonModal({
  initialValue = {},
  onChange,
  onRequestClose,
  title,
}: ShareJsonModalProps): React.JSX.Element {
  const { classes } = useStyles();
  const [value, setValue] = useState(JSON.stringify(initialValue, undefined, 2) ?? "");

  const { decodedValue, error } = useMemo(() => {
    try {
      return { decodedValue: JSON.parse(value === "" ? "{}" : value) as unknown, error: undefined };
    } catch (err: unknown) {
      return { decodedValue: undefined, error: err as Error };
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    onChange(decodedValue);
    onRequestClose();
  }, [decodedValue, onChange, onRequestClose]);

  const handleDownload = useCallback(() => {
    downloadTextFile(value, "layout.json");
  }, [value]);

  const getText = useCallback(() => value, [value]);

  return (
    <Dialog open onClose={onRequestClose} maxWidth="sm" fullWidth>
      <DialogTitle className={classes.dialogTitle}>
        {title}
        <IconButton onClick={onRequestClose} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          className={classes.textarea}
          fullWidth
          multiline
          rows={10}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          autoFocus
          error={error != undefined}
          helperText={
            error ? "The JSON provided is invalid." : " " // pass whitespace to prevent height from jumping
          }
          slotProps={{
            htmlInput: { "data-testid": "share-json-input" },
            formHelperText: { variant: "standard" },
          }}
          spellCheck={false}
        />
      </DialogContent>
      <DialogActions>
        <Stack direction="row" gap={1}>
          <IconButton onClick={handleDownload} title="Download" aria-label="Download">
            <ArrowDownload20Filled />
          </IconButton>
          <CopyButton color="inherit" getText={getText} />
          <HoverableIconButton
            activeColor="error"
            onClick={() => {
              setValue("{}");
            }}
            title="Clear"
            aria-label="Clear"
            icon={<Delete20Regular />}
          />
        </Stack>

        <Stack flex="auto" />

        <Button disabled={error != undefined} variant="contained" onClick={handleSubmit}>
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
