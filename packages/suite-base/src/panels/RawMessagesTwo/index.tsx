// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Panel from "@lichtblick/suite-base/components/Panel";
import RawMessagesTwo from "@lichtblick/suite-base/panels/RawMessagesTwo/RawMessagesTwo";
import { RAW_MESSAGES_TWO_DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/RawMessagesTwo/constants";

export default Panel(
  Object.assign(RawMessagesTwo, {
    panelType: "RawMessagesTwo",
    defaultConfig: RAW_MESSAGES_TWO_DEFAULT_CONFIG,
  }),
);
