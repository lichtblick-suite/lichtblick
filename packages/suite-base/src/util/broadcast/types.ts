// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/suite";

export type BroadcastMessageEvent = { type: "play" | "pause" | "seek" | "playUntil"; time: Time };

export type ChannelListeners = Set<(message: BroadcastMessageEvent) => void>;
