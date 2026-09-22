// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import { IconButton } from "@mui/material";
import { MouseEvent } from "react";

export default function LayoutFavoriteToggle({
  favorite,
  onToggle,
}: Readonly<{
  favorite: boolean;
  onToggle: (event: MouseEvent) => void;
}>): React.JSX.Element {
  return (
    <IconButton
      data-testid="toggle-favorite-layout"
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={onToggle}
    >
      {favorite ? <StarIcon fontSize="small" /> : <StarOutlineIcon fontSize="small" />}
    </IconButton>
  );
}
