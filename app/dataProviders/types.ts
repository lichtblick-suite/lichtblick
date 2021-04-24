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

import { Time } from "rosbag";

import {
  Progress,
  Topic,
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  TypedMessage,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";

// `DataProvider` describes a more specific kind of data ingesting than `Player`, namely ingesting
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
// A DataProvider initially returns basic information, such as the time range for which we have data,
// and the topics and data types. It then allows for requesting messages for arbitrary time ranges
// within, though it is the caller's responsibility to request small enough time ranges, since in
// general DataProviders give no guarantees of how fast they return the data.
//
// The properties of immutability and idempotence make it very easy to compose different
// DataProviders. For example, you can have a BagDataProvider which reads from a ROS bag, but which
// takes a bit of time to decompress the ROS bag. So you might wrap it in a WorkerDataProvider,
// which puts its children in a Web Worker, therefore allowing the decompression to happen in
// parallel to the main thread. And you might wrap that in turn in a MemoryCacheDataProvider, which
// does some in-memory read-ahead caching based on the most recent time range that was requested.
// These trees of DataProviders are described by `DataProviderDescriptor`.
//
// DataProviders have a strict API which is enforced automatically in ApiCheckerDataProvider. It's
// also easy to measure the performance of each DataProvider in a tree by putting using the
// `_measureDataProviders` URL param, which causes every DataProvider to be wrapped in a
// MeasureDataProvider.

export type GetMessagesTopics = Readonly<{
  parsedMessages?: readonly string[];
  rosBinaryMessages?: readonly string[];
}>;

export type GetMessagesResult = Readonly<{
  parsedMessages?: readonly TypedMessage<unknown>[];
  rosBinaryMessages?: readonly TypedMessage<ArrayBuffer>[];
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
      // Optional, the md5 sum of the message definition by topic.
      messageDefinitionMd5SumByTopic?: {
        [key: string]: string;
      };
    }>
  | ParsedMessageDefinitions;

export interface DataProvider {
  // Do any up-front initializing of the provider, and takes an optional extension point for
  // callbacks that only some implementations care about. May only be called once. If there's an
  // error during initialization, it must be reported using `sendNotification` (even in Web Workers).
  // If the error is unrecoverable, just never resolve the promise.
  // TODO(JP): It would be better to reject the promise explicitly in case of unrecoverable errors,
  // so we can update the UI appropriately.
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

export interface MessageReader {
  readMessage<T>(buffer: Readonly<Uint8Array>): T;
}

export interface DataProviderConstructor {
  new (
    // The arguments to this particular DataProvider; typically an object.
    args: any,
    // The children we should instantiate below. Many DataProviders cannot have any children (leaf
    // nodes in the tree), many require exactly one child, and the `CombinedDataProvider` can take
    // an arbitrary number of children.
    children: DataProviderDescriptor[],
    // The function to instantiate the children (different in e.g. Web Workers).
    getDataProvider: GetDataProvider,
  ): DataProvider;
}

export type InitializationResult = {
  start: Time; // Inclusive (time of first message).
  end: Time; // Inclusive (time of last message).
  topics: Topic[];
  connections: Connection[];

  // Signals whether the messages returned from calls to getMessages are parsed into Javascript
  // objects or are returned in ROS binary format.
  // TODO(steel/hernan): Replace topics and providesParsedMessages with a GetMessagesResult, and
  // update the ApiCheckerDataProvider to enforce it.
  providesParsedMessages: boolean;
  messageDefinitions: MessageDefinitions;
};

export type ExtensionPoint = {
  // Report some sort of progress, e.g. of caching or downloading.
  progressCallback: (progress: Progress) => void;

  // Report some sort of metadata to the `Player`, see below for different kinds of metadata.
  // TODO(JP): this is a bit of an odd one out. Maybe we should unify this with the
  // `progressCallback` and have one type of "status" object?
  reportMetadataCallback: (metadata: DataProviderMetadata) => void;
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

export type DataProviderStall = Readonly<{
  type: "data_provider_stall";
  stallDuration: Time;
  requestTimeUntilStall: Time;
  transferTimeUntilStall: Time;
  bytesReceivedBeforeStall: number;
}>;

export type DataProviderMetadata = // Report whether or not the DataProvider is reconnecting to some external server. Used to show a
  // loading indicator in the UI.
  | Readonly<{ type: "updateReconnecting"; reconnecting: boolean }>
  | AverageThroughput
  | InitializationPerformanceMetadata
  | ReceivedBytes
  | DataProviderStall;

// A ROS bag "connection", used for parsing messages.
export type Connection = {
  messageDefinition: string;
  md5sum: string;
  topic: string;
  type: string;
  callerid: string;
};

// DataProviders can be instantiated using a DataProviderDescriptor and a GetDataProvider function.
// Because the descriptor is a plain JavaScript object, it can be sent over an Rpc Channel, which
// means that you can describe a chain of data providers that includes a Worker or a WebSocket.
export type DataProviderDescriptor = {
  name: string;
  args: any;
  children: DataProviderDescriptor[];
};

export type GetDataProvider = (arg0: DataProviderDescriptor) => DataProvider;
