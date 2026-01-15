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
    callService: jest.fn(),
    datatypes: new Map(),
    fetchAsset: jest.fn(),
    messageEventsBySubscriberId: new Map(),
    pauseFrame: jest.fn(),
    publish: jest.fn(),
    seekPlayback: jest.fn(),
    setParameter: jest.fn(),
    setPublishers: jest.fn(),
    setSubscriptions: jest.fn(),
    subscriptions: [],
    getMetadata: jest.fn(),
    getBatchIterator: () => undefined,
  };
  const result = getTopicToSchemaNameMap(state);
  expect(result).toEqual({
    topic1: "schema1",
    topic2: "schema2",
  });
});
