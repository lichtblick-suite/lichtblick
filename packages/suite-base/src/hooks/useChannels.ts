// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useMemo } from "react";

import { Channel } from "@lichtblick/suite";
import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import {
  selectInstalledMessageConverters,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { channelCatalog } from "@lichtblick/suite-base/util/channels";

/** The same native and converter-output catalog used by extension panels. */
export function useChannels(): Channel[] {
  const { topics } = useDataSourceInfo();
  const converters = useExtensionCatalog(selectInstalledMessageConverters);
  return useMemo(() => channelCatalog(topics, converters), [topics, converters]);
}
