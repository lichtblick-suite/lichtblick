// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Panel from "@lichtblick/suite-base/components/Panel";
import RawMessagesVirtual from "@lichtblick/suite-base/panels/RawMessagesVirtual/RawMessagesVirtual";
import { RAW_MESSAGES_VIRTUAL_DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/RawMessagesVirtual/constants";

export default Panel(
  Object.assign(RawMessagesVirtual, {
    panelType: "RawMessagesVirtual",
    defaultConfig: RAW_MESSAGES_VIRTUAL_DEFAULT_CONFIG,
  }),
);
