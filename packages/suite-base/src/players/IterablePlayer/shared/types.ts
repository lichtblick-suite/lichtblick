// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  IIterableSource,
  Initialization,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

export type MultiSource = { type: "files"; files: Blob[] } | { type: "urls"; urls: string[] };

export type IterableSourceConstructor<T extends IIterableSource, P> = new (args: P) => T;

export type InitMetadata = Initialization["metadata"];

export type InitTopicStatsMap = Initialization["topicStats"];
