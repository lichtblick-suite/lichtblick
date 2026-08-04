// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { McapIndexedReader } from "@mcap/core";

import type { ISerializedIterableSource } from "../IIterableSource";
import type { RemoteFileReadable } from "./RemoteFileReadable";
import type { HydratedSourcePool } from "../shared/HydratedSourcePool";

export type McapSource =
  | { type: "file"; file: Blob; pool?: HydratedSourcePool }
  | {
      type: "url";
      url: string;
      cacheSizeInBytes?: number;
      readAheadEnabled?: boolean;
      readAheadBufferBytes?: number;
      pool?: HydratedSourcePool;
    };

export type HydratedInner = {
  inner: ISerializedIterableSource;
  readable?: RemoteFileReadable;
  weightBytes: number;
};

export type IndexedReaderResult =
  | { status: "indexed"; reader: McapIndexedReader }
  | { status: "unindexed" }
  | { status: "failed"; error: Error };

export type OpenedInner = {
  inner: ISerializedIterableSource;
  readable?: RemoteFileReadable;
  indexed: boolean;
  weightBytes: number;
};
