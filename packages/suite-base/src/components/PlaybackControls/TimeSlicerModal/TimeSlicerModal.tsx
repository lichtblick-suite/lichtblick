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
} from "@mui/material";
import { useEffect, useState } from "react";

import { Time, toRFC3339String } from "@lichtblick/rostime";
import ResetTimeRangeButton from "@lichtblick/suite-base/components/PlaybackControls/TimeSlicerModal/ResetTimeRangeButton";
import { updateAppURLState } from "@lichtblick/suite-base/util/appURLState";
import { usePlayerMarksStore } from "@lichtblick/suite-base/util/usePlayerMarksStore";

import { useStyles } from "./TimeSlicerModal.style";

type TimeSlicerModalProps = {
  open: boolean;
  onClose: () => void;
  startTime?: Time;
  endTime?: Time;
};

export default function TimeSlicerModal(props: TimeSlicerModalProps): React.JSX.Element {
  const { open, onClose, startTime, endTime } = props;
  const { classes } = useStyles();
  const { setStartMark, setEndMark } = usePlayerMarksStore();

  const [fromMark, setFromMark] = useState<string>("");
  const [toMark, setToMark] = useState<string>("");
  const startMark = usePlayerMarksStore((state) => state.startMark);
  const endMark = usePlayerMarksStore((state) => state.endMark);

  const handleCancel = () => {
    onClose();
  };

  useEffect(() => {
    setFromMark(startMark ? toRFC3339String(startMark) : toRFC3339String(startTime!));
    setToMark(endMark ? toRFC3339String(endMark) : toRFC3339String(endTime!));
  }, [startMark, endMark, startTime, endTime]);

  const handleSlice = () => {
    // Update URL with marks - This probably should be done on useAppUrlState
    const newStateUrl = updateAppURLState(new URL(window.location.href), {
      from: fromMark,
      to: toMark,
    });
    window.history.replaceState(undefined, "", decodeURIComponent(newStateUrl.href));

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
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <ResetTimeRangeButton
                label="Start time"
                time={startTime}
                setStartMark={setStartMark}
              />
              <TextField
                value={fromMark}
                onChange={(event) => {
                  setFromMark(event.target.value);
                }}
                fullWidth
              />
            </Stack>
            <Stack spacing={0.5}>
              <ResetTimeRangeButton label="End time" time={endTime} setEndMark={setEndMark} />
              <TextField
                value={toMark}
                onChange={(event) => {
                  setToMark(event.target.value);
                }}
                fullWidth
              />
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button color="inherit" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSlice}>
          Slice range
        </Button>
      </DialogActions>
    </Dialog>
  );
}
