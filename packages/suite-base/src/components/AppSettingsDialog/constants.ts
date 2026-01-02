// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AppSettingsSectionKey } from "@lichtblick/suite-base/components/AppSettingsDialog/types";
import { LICHTBLICK_DOCUMENTATION_LINK } from "@lichtblick/suite-base/constants/documentation";

export const APP_SETTINGS_ABOUT_ITEMS = new Map<
  AppSettingsSectionKey,
  {
    subheader: string;
    links: { title: string; url?: string }[];
  }
>([
  [
    "documentation",
    {
      subheader: "Documentation",
      links: [
        {
          title: "Check out our documentation",
          url: LICHTBLICK_DOCUMENTATION_LINK,
        },
      ],
    },
  ],
  [
    "legal",
    {
      subheader: "Legal",
      links: [
        {
          title: "License terms",
          url: "https://github.com/lichtblick-suite/lichtblick/blob/main/LICENSE",
        },
      ],
    },
  ],
]);
