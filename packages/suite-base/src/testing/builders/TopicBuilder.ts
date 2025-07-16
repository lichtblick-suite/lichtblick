// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Topic } from "@lichtblick/suite-base/players/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";

export default class TopicBuilder {
  public static topic(props: Partial<Topic> = {}): Topic {
    return defaults<Topic>(props, {
      name: BasicBuilder.string(),
      schemaName: BasicBuilder.string(),
      aliasedFromName: BasicBuilder.string(),
    });
  }
}
