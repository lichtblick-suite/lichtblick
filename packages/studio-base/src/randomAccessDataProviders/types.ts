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

import { Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import {
  Progress,
  Topic,
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  MessageEvent,
  PlayerProblem,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

// `RandomAccessDataProvider` describes a more specific kind of data ingesting than `Player`, namely ingesting
// data that we have random access to. From Wikipedia:
//
//   "Random access is the ability to access an arbitrary element of a sequence in equal time or any
//    datum from a population of addressable elements roughly as easily and efficiently as any other,
//    no matter how many elements may be in the set."
//
// The data is stored somewhere (e.g. in a local file, or on some server), in some sort of
// representation (e.g. a ROS bag, or a JSON file, or something else). Conceptually, we treat the
// data as static and immutable, which means that when you fetch the same time range twice, you
// should get the exact same messages, and when you fetch one time range, you should get the exact
// same messages as when splitting it into two fetch calls with shorter time ranges.
//
// A RandomAccessDataProvider initially returns basic information, such as the time range for which we have data,
// and the topics and data types. It then allows for requesting messages for arbitrary time ranges
// within, though it is the caller's responsibility to request small enough time ranges, since in
// general RandomAccessDataProviders give no guarantees of how fast they return the data.
export type RandomAccessDataProviderProblem = {
  severity: "error" | "warn";
  message: string;
  error?: Error;
  tip?: string;
};

export type GetMessagesTopics = Readonly<{
  parsedMessages?: readonly string[];
  encodedMessages?: readonly string[];
}>;

export type GetMessagesResult = Readonly<{
  parsedMessages?: readonly MessageEvent<unknown>[];
  encodedMessages?: readonly MessageEvent<ArrayBuffer>[];
  problems?: readonly PlayerProblem[];
}>;

export type ParsedMessageDefinitions = Readonly<{
  type: "parsed";
  datatypes: RosDatatypes;
  // Note that these might not be "complete" - rely on the parsedMessageDefinitionsByTopic for the
  // complete list of message definitions!
  messageDefinitionsByTopic: MessageDefinitionsByTopic;
  parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic;
}>;

export type MessageDefinitions =
  | Readonly<{
      type: "raw";
      // The ROS message definitions for each provided topic. Entries are required for topics that are
      // available through the data provider in binary format, either directly through getMessages calls
      // or indirectly through the player progress mechanism.
      messageDefinitionsByTopic: MessageDefinitionsByTopic;
    }>
  | ParsedMessageDefinitions;

export interface RandomAccessDataProvider {
  // Do any up-front initializing of the provider, and takes an optional extension point for
  // callbacks that only some implementations care about. May only be called once. If there's an
  // error during initialization, it must be reported using `sendNotification` (even in Web Workers).
  // If the error is unrecoverable, just never resolve the promise.
  initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult>;
  // Get messages for a time range inclusive of start and end matching any of the provided topics.
  // May only be called after `initialize` has finished. Returned messages must be ordered by
  // `receiveTime`. May not return any messages outside the time range, or outside the requested
  // list of topics. Must always return the same messages for a given time range, including when
  // querying overlapping time ranges multiple times.
  getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult>;
  // Close the provider (e.g. close any connections to a server). Must be called only after
  // `initialize` has finished.
  close(): Promise<void>;
}

export type InitializationResult = {
  start: Time; // Inclusive (time of first message).
  end: Time; // Inclusive (time of last message).
  topics: Topic[];
  topicStats: Map<string, TopicStats>;
  connections: Connection[];
  parameters?: Map<string, ParameterValue>;
  profile: string | undefined;

  // Signals whether the messages returned from calls to getMessages are parsed into Javascript
  // objects or are returned in ROS binary format.
  providesParsedMessages: boolean;
  messageDefinitions: MessageDefinitions;

  // Any errors or warnings that should be surfaced to the user as a result of initializing a data
  // provider
  problems: RandomAccessDataProviderProblem[];
};

export type ExtensionPoint = {
  // Report some sort of progress, e.g. of caching or downloading.
  progressCallback: (progress: Progress) => void;

  // Report some sort of metadata to the `Player`, see below for different kinds of metadata.
  reportMetadataCallback: (metadata: RandomAccessDataProviderMetadata) => void;
};

export type InitializationPerformanceMetadata = Readonly<{
  type: "initializationPerformance";
  dataProviderType: string;
  metrics: {
    [metricName: string]: string | number;
  };
}>;

export type AverageThroughput = Readonly<{
  type: "average_throughput";
  totalSizeOfMessages: number; // bytes
  numberOfMessages: number;
  requestedRangeDuration: Time;
  receivedRangeDuration: Time; // Connections could be canceled on seeks.
  topics: readonly string[];
  totalTransferTime: Time;
}>;

// To report chunks of data received in realtime. Aggregation can happen downstream. For bags, this
// includes all data -- not just data on relevant topics.
export type ReceivedBytes = Readonly<{
  type: "received_bytes";
  bytes: number;
}>;

export type RandomAccessDataProviderStall = Readonly<{
  type: "data_provider_stall";
  stallDuration: Time;
  requestTimeUntilStall: Time;
  transferTimeUntilStall: Time;
  bytesReceivedBeforeStall: number;
}>;

// Report whether or not the RandomAccessDataProvider is reconnecting to some external server. Used
// to show a loading indicator in the UI.
export type RandomAccessDataProviderMetadata =
  | Readonly<{ type: "updateReconnecting"; reconnecting: boolean }>
  | AverageThroughput
  | InitializationPerformanceMetadata
  | ReceivedBytes
  | RandomAccessDataProviderStall;

// A ROS bag "connection", used for parsing messages.
export type Connection = {
  messageDefinition: string;
  md5sum: string;
  topic: string;
  type: string;
  callerid: string;
};
