// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ArrowUndoFilled } from "@fluentui/react-icons";
import { Stack } from "@mui/material";

import { Time } from "@lichtblick/rostime";
import HoverableIconButton from "@lichtblick/suite-base/components/HoverableIconButton";

import { useStyles } from "./ResetTimeRangeButton.style";

type ResetTimeRangeButtonProps = {
  label: string;
  time?: Time;
  setStartMark?: (startMark: Time) => void;
  setEndMark?: (endMark: Time) => void;
};

export default function ResetTimeRangeButton(props: ResetTimeRangeButtonProps): React.JSX.Element {
  const { classes } = useStyles();
  const { label, time, setStartMark, setEndMark } = props;

  const resetTimeRange = () => {
    if (time) {
      if (setStartMark) {
        setStartMark(time);
      }
      if (setEndMark) {
        setEndMark(time);
      }
    }
  };

  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <span className={classes.label}>{label}</span>
      <HoverableIconButton size="small" icon={<ArrowUndoFilled />} onClick={resetTimeRange} />
    </Stack>
  );
}
