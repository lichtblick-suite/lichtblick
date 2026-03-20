// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  Initialization,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

export type MultiSource =
  | { type: "files"; files: Blob[] }
  | { type: "urls"; urls: string[]; totalCacheSizeInBytes?: number };

export type IterableSourceConstructor<T extends IIterableSource, P> = new (args: P) => T;

export type InitMetadata = Initialization["metadata"];

export type InitTopicStatsMap = Initialization["topicStats"];

export type SourceWithTime = {
  source: IIterableSource;
  startTime: Time;
  endTime: Time;
};

export type SequentialIteratorMergeOptions<T extends IteratorResult> = {
  value: T;
  iterator: AsyncIterableIterator<Readonly<IteratorResult>>;
};
