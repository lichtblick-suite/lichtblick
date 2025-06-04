// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Metadata } from "@lichtblick/suite";
import { Initialization } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";

export default class InitilizationSourceBuilder {
  public static initialization(props: Partial<Initialization> = {}): Initialization {
    return defaults<Initialization>(props, {
      start: RosTimeBuilder.time(),
      end: RosTimeBuilder.time(),
      datatypes: new Map(),
      publishersByTopic: new Map(),
      topicStats: new Map(),
      alerts: [],
      topics: [],
      metadata: [],
      profile: BasicBuilder.string(),
    });
  }

  public static metadata(props: Partial<Metadata> = {}): Metadata {
    return defaults<Metadata>(props, {
      name: BasicBuilder.string(),
      metadata: BasicBuilder.genericDictionary(String),
    });
  }

  public static metadataList(count = 3): Metadata[] {
    return BasicBuilder.multiple(InitilizationSourceBuilder.metadata, count);
  }
}
