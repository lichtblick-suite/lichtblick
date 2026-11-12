// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AdditionalSourceDescriptor } from "@lichtblick/suite-base/players/IterablePlayer/additionalSources/types";

export type SourceBundleMcap = {
  url: string;
  metadata: Record<string, unknown>;
};

export type SourceBundleResponse = {
  mcaps: SourceBundleMcap[];
  /**
   * Self-describing additional (non-MCAP) sources to merge into the same source bundle.
   * Each source supplies its own topics, schemas and serialized messages (see
   * {@link AdditionalSourceDescriptor}); this app only transports and merges them.
   */
  additionalSources?: AdditionalSourceDescriptor[];
};

export type SourceBundleData = {
  mcaps: SourceBundleMcap[];
  additionalSources: AdditionalSourceDescriptor[];
};
