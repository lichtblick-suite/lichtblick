// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { formatTimeRaw } from "@lichtblick/suite-base/util/time";
import { usePlayerMarksStore } from "@lichtblick/suite-base/util/usePlayerMarksStore";

import { useStyles } from "./TimeSlicerModal.style";

type TimeSlicerModalProps = {
  open: boolean;
  onClose: () => void;
  onSlice?: () => void;
};

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;

const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

export default function TimeSlicerModal(props: TimeSlicerModalProps): React.JSX.Element {
  const { open, onClose, onSlice } = props;
  const { classes } = useStyles();
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);

  const startMark = usePlayerMarksStore((state) => state.startMark);
  const endMark = usePlayerMarksStore((state) => state.endMark);

  const canSlice = startMark != undefined && endMark != undefined;

  const handleCancel = () => {
    onClose();
  };

  const handleSlice = () => {
    if (onSlice) {
      onSlice();
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="xs"
      hideBackdrop
      slotProps={{
        paper: {
          sx: {
            pointerEvents: "auto",
          },
        },
      }}
      className={classes.modal}
    >
      <DialogTitle>Slice Playback Range</DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Stack spacing={2.5}>
          <Typography variant="body2" className={classes.helperText}>
            Add two marks on the scrubber to define the window you would like to keep. We will trim
            everything outside of that time span.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Start Time"
              value={startMark ? formatTimeRaw(startMark) : formatTimeRaw(startTime!)}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                },
              }}
            />
            <TextField
              label="End Time"
              value={endMark ? formatTimeRaw(endMark) : formatTimeRaw(endTime!)}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                },
              }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button color="inherit" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!canSlice} onClick={handleSlice}>
          Slice range
        </Button>
      </DialogActions>
    </Dialog>
  );
}
