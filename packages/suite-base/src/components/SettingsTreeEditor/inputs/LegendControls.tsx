// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { IconButton } from "@mui/material";

import { useLegendCount } from "./useLegendCount";

export const LegendControls = (): React.JSX.Element => {
  const { increment, decrement } = useLegendCount();

  return (
    <div data-testid="LegendControls">
      <IconButton onClick={increment}>
        <AddIcon />
      </IconButton>
      <IconButton onClick={decrement}>
        <RemoveIcon />
      </IconButton>
    </div>
  );
};
