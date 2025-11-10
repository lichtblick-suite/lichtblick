// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";
// foxglove-depcheck-used: @lichtblick/suite-desktop
import IconSvg from "@lichtblick/suite-desktop/resources/icon/icon.svg";

export function LichtblickLogo(props: SvgIconProps): React.JSX.Element {
  return (
    <SvgIcon component={IconSvg} viewBox="0 0 1024 1024" {...props}>
      <title>Lichtblick</title>
    </SvgIcon>
  );
}
