// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ArrowDownload20Filled } from "@fluentui/react-icons";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import {
  Button,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  outlinedInputClasses,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import CopyButton from "@foxglove/studio-base/components/CopyButton";
import HoverableIconButton from "@foxglove/studio-base/components/HoverableIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { downloadTextFile } from "@foxglove/studio-base/util/download";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

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
      fontFamily: fonts.MONOSPACE,
      maxHeight: "60vh",
      overflowY: "auto",
      padding: theme.spacing(0.25),
    },
  },
}));

export function ShareJsonModal({
  initialValue = {},
  onChange,
  onRequestClose,
  title,
}: ShareJsonModalProps): JSX.Element {
  const { classes } = useStyles();
  const [value, setValue] = useState(JSON.stringify(initialValue, undefined, 2) ?? "");

  const { decodedValue, error } = useMemo(() => {
    try {
      return { decodedValue: JSON.parse(value === "" ? "{}" : value) as unknown, error: undefined };
    } catch (err) {
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
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        paddingX={3}
        paddingTop={2}
      >
        <Stack>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            {title}
          </Typography>
        </Stack>

        <IconButton onClick={onRequestClose} edge="end">
          <CloseIcon />
        </IconButton>
      </Stack>
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
          inputProps={{ "data-testid": "share-json-input" }}
          FormHelperTextProps={{ variant: "standard" }}
          spellCheck={false}
        />
      </DialogContent>
      <DialogActions>
        <Stack direction="row" gap={1}>
          <IconButton onClick={handleDownload} title="Download" aria-label="Download">
            <ArrowDownload20Filled />
          </IconButton>
          <CopyButton color="default" getText={getText} />
          <HoverableIconButton
            activeColor="error"
            onClick={() => {
              setValue("{}");
            }}
            title="Clear"
            aria-label="Clear"
            icon={<DeleteOutline />}
          />
        </Stack>

        <Stack flex="auto" />

        <Button
          disabled={error != undefined}
          variant="contained"
          size="large"
          onClick={handleSubmit}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
