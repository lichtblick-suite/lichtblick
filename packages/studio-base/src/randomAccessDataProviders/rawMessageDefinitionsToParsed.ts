// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { fromPairs, uniq } from "lodash";

import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { Topic, ParsedMessageDefinitionsByTopic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { MessageDefinitions, ParsedMessageDefinitions } from "./types";

// Extract one big list of datatypes from the individual connections.
function parsedMessageDefinitionsToDatatypes(
  parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic,
  topics: Topic[],
): RosDatatypes {
  const topLevelDatatypeNames: string[] = uniq(topics.map(({ datatype }) => datatype));
  // many topics can have the same datatype, but that shouldn't matter here - we just want any topic.
  const topicNameByDatatypeName: {
    [key: string]: string;
  } = fromPairs(topics.map(({ name, datatype }) => [datatype, name]));
  const datatypes: RosDatatypes = new Map();
  topLevelDatatypeNames.forEach((datatypeName) => {
    const topicName = topicNameByDatatypeName[datatypeName];
    if (topicName == undefined) {
      return;
    }
    const parsedMessageDefinition = parsedMessageDefinitionsByTopic[topicName];
    if (!parsedMessageDefinition) {
      return;
    }
    parsedMessageDefinition.forEach(({ name, definitions }, index) => {
      // The first definition usually doesn't have an explicit name,
      // so we get the name from the datatype.
      if (index === 0) {
        datatypes.set(datatypeName, { name: datatypeName, definitions });
      } else if (name != undefined) {
        datatypes.set(name, { name, definitions });
      }
    });
  });
  return datatypes;
}

export default function rawMessageDefinitionsToParsed(
  messageDefinitions: MessageDefinitions,
  topics: Topic[],
): ParsedMessageDefinitions {
  if (messageDefinitions.type === "parsed") {
    return messageDefinitions;
  }
  const parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
  for (const [topic, topicDefinitions] of Object.entries(
    messageDefinitions.messageDefinitionsByTopic,
  )) {
    const messageDefinition = topicDefinitions;
    parsedMessageDefinitionsByTopic[topic] = parseMessageDefinition(messageDefinition);
  }
  return {
    type: "parsed",
    messageDefinitionsByTopic: messageDefinitions.messageDefinitionsByTopic,
    datatypes: parsedMessageDefinitionsToDatatypes(parsedMessageDefinitionsByTopic, topics),
    parsedMessageDefinitionsByTopic,
  };
}
