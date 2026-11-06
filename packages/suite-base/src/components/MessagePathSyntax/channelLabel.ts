// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Channel } from "@lichtblick/suite";

export function channelLabel(channel: Channel): string {
  const source =
    channel.source.kind === "native"
      ? `Native (${channel.id})`
      : `Converted (${channel.source.inputChannelId} -> ${channel.source.converterId})`;
  return `${channel.schemaName} · ${source}`;
}
