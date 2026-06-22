// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getTopicToSchemaNameMap } from "@lichtblick/suite-base/components/MessagePipeline/selectors";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

it("map schema names by topic name", () => {
  const state: MessagePipelineContext = {
    sortedTopics: [
      { name: "topic1", schemaName: "schema1" },
      { name: "topic2", schemaName: "schema2" },
    ],
    sortedServices: [],
    playerState: {
      presence: PlayerPresence.PRESENT,
      progress: {},
      capabilities: [],
      profile: undefined,
      playerId: "",
    },
    callService: vi.fn(),
    datatypes: new Map(),
    fetchAsset: vi.fn(),
    messageEventsBySubscriberId: new Map(),
    pauseFrame: vi.fn(),
    publish: vi.fn(),
    seekPlayback: vi.fn(),
    setParameter: vi.fn(),
    setPublishers: vi.fn(),
    setSubscriptions: vi.fn(),
    subscriptions: [],
    getMetadata: vi.fn(),
    getBatchIterator: () => undefined,
  };
  const result = getTopicToSchemaNameMap(state);
  expect(result).toEqual({
    topic1: "schema1",
    topic2: "schema2",
  });
});
