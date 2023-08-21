// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TopicSelection } from "@foxglove/studio-base/players/types";

export function mockTopicSelection(...topics: readonly string[]): TopicSelection {
  return new Map(topics.map((topic) => [topic, { topic }]));
}
