// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AdditionalSourceDescriptor } from "@lichtblick/suite-base/players/IterablePlayer/additionalSources/types";

export type SessionMcap = {
  url: string;
  metadata: Record<string, unknown>;
};

export type SessionResponse = {
  mcaps: SessionMcap[];
  /**
   * Self-describing additional (non-MCAP) sources to merge into the session.
   * Each source supplies its own topics, schemas and serialized messages (see
   * {@link AdditionalSourceDescriptor}); this app only transports and merges them.
   */
  additionalSources?: AdditionalSourceDescriptor[];
};

export type SessionData = {
  mcaps: SessionMcap[];
  additionalSources: AdditionalSourceDescriptor[];
};
