// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ScreenCutRegular } from "@fluentui/react-icons";
import { Stack, Button } from "@mui/material";

import HoverableIconButton from "@lichtblick/suite-base/components/HoverableIconButton";

import { useStyles } from "./TimeSlicerToggle.style";

type TimeSlicerToggleProps = {
  onClick: () => void;
};

const TimeSlicerToggle = ({ onClick }: TimeSlicerToggleProps): React.JSX.Element => {
  const { classes } = useStyles();

  return (
    <Button className={classes.button} onClick={onClick}>
      <Stack>
        <HoverableIconButton size="small" icon={<ScreenCutRegular />} />
      </Stack>
    </Button>
  );
};

export default TimeSlicerToggle;
