// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { NormalizedLogMessage } from "@lichtblick/suite-base/panels/Log/types";
import { formatTime } from "@lichtblick/suite-base/util/formatTime";

import LevelToString from "./LevelToString";

const formattedMessage = (item: NormalizedLogMessage, timezone?: string): string => {
  return `[${LevelToString(item.level)}] [${formatTime(item.stamp, timezone)}] [${item.name}] ${item.message}`;
};

export default function formatMessages(items: NormalizedLogMessage[], timezone?: string): string[] {
  const messages = items.map((item) => formattedMessage(item, timezone));
  return messages;
}
