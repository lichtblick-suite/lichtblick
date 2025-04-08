// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CircularProgress, Stack } from "@mui/material";

import EmptyState from "@lichtblick/suite-base/components/EmptyState";

interface InstallingSnackbarProps {
  installed: number;
  total: number;
}

const InstallingSnackbar: React.FC<InstallingSnackbarProps> = ({ installed, total }) => {
  return (
    <EmptyState>
    <Stack direction="row" gap={1} alignItems="center" color="white">
      <CircularProgress color="primary"size={12} />
      <span>Installing extensions... ({installed}/{total})</span>
    </Stack>
  </EmptyState>
  );
};

export default InstallingSnackbar;
