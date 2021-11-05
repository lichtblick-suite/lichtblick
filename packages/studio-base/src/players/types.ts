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

import { RosMsgDefinition } from "@foxglove/rosmsg";
import { Time } from "@foxglove/rostime";
import type { MessageEvent } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { BlockCache } from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import {
  AverageThroughput,
  RandomAccessDataProviderStall,
  InitializationPerformanceMetadata,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { Range } from "@foxglove/studio-base/util/ranges";
import { NotificationSeverity } from "@foxglove/studio-base/util/sendNotification";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

// re-exported until other import sites are updated from players/types to @foxglove/studio
export type { MessageEvent };

export type MessageDefinitionsByTopic = {
  [topic: string]: string;
};
export type ParsedMessageDefinitionsByTopic = {
  [topic: string]: RosMsgDefinition[];
};

// Valid types for parameter data (such as rosparams)
export type ParameterValue =
  | undefined
  | boolean
  | number
  | string
  | Date
  | Uint8Array
  | ParameterValue[]
  | ParameterStruct;

export type ParameterStruct = { [key: string]: ParameterValue };

// A `Player` is a class that manages playback state. It manages subscriptions,
// current time, which topics and datatypes are available, and so on.
// For more details, see the types below.

export interface Player {
  // The main way to get information out the player is to set a listener. This listener will be
  // called whenever the PlayerState changes, so that we can render the new state to the UI. Users
  // should return a promise from the listener that resolves when the UI has finished updating, so
  // that we don't get overwhelmed with new state that we can't keep up with. The Player is
  // responsible for appropriately throttling based on when we resolve this promise.
  setListener(listener: (arg0: PlayerState) => Promise<void>): void;
  // Close the player; i.e. terminate any connections it might have open.
  close(): void;
  // Set a new set of subscriptions/advertisers. This might trigger fetching
  // new data, which might in turn trigger a backfill of messages.
  setSubscriptions(subscriptions: SubscribePayload[]): void;
  setPublishers(publishers: AdvertiseOptions[]): void;
  // Modify a remote parameter such as a rosparam.
  setParameter(key: string, value: ParameterValue): void;
  // If the Player supports publishing (i.e. PlayerState#capabilities contains
  // PlayerCapabilities.advertise), publish a message.
  publish(request: PublishPayload): void;
  // Basic playback controls.
  startPlayback(): void;
  pausePlayback(): void;
  seekPlayback(time: Time, backfillDuration?: Time): void;
  // Seek to a particular time. Might trigger backfilling.
  // If the Player supports non-real-time speeds (i.e. PlayerState#capabilities contains
  // PlayerCapabilities.setSpeed), set that speed. E.g. 1.0 is real time, 0.2 is 20% of real time.
  setPlaybackSpeed(speedFraction: number): void;
  // Request a backfill for Players that support it. Allowed to be a no-op if the player does not
  // support backfilling, or if it's already playing (in which case we'd get new messages soon anyway).
  // This is currently called after subscriptions changed. We do our best in the MessagePipeline to
  // not call this method too often (e.g. it's debounced).
  // TODO(JP): We can't call this too often right now, since it clears out all existing data in
  // panels, so e.g. the Plot panel which might have a lot of data loaded would get cleared to just
  // a small backfilled amount of data. We should somehow make this more granular.
  requestBackfill(): void;
  // Set the globalVariables for Players that support it.
  // This is generally used to pass new globalVariables to the UserNodePlayer
  setGlobalVariables(globalVariables: GlobalVariables): void;
}

export enum PlayerPresence {
  NOT_PRESENT = "NOT_PRESENT",
  INITIALIZING = "INITIALIZING",
  RECONNECTING = "RECONNECTING",
  PRESENT = "PRESENT",
  ERROR = "ERROR",
}

export type PlayerProblem = {
  severity: NotificationSeverity;
  message: string;
  error?: Error;
  tip?: string;
};

export type PlayerState = {
  // Information about the player's presence or connection status, for the UI to show a loading indicator.
  presence: PlayerPresence;

  // Show some sort of progress indication in the playback bar; see `type Progress` for more details.
  // TODO(JP): Maybe we should unify some progress and the other initialization fields above into
  // one "status" object?
  progress: Progress;

  // Capabilities of this particular `Player`, which are not shared across all players.
  // See `const PlayerCapabilities` for more details.
  capabilities: typeof PlayerCapabilities[keyof typeof PlayerCapabilities][];

  // A unique id for this player (typically a UUID generated on construction). This is used to clear
  // out any data when switching to a new player.
  playerId: string;

  // String name for the player
  // The player could set this value to represent the current connection, name, ports, etc.
  name?: string;

  /** A path to a file on disk currently being accessed by the player */
  filePath?: string;

  // Surface issues during playback or player initialization
  problems?: PlayerProblem[];

  // The actual data to render panels with. Can be empty during initialization, until all this data
  // is known. See `type PlayerStateActiveData` for more details.
  activeData?: PlayerStateActiveData;
};

export type PlayerStateActiveData = {
  // An array of (ROS-like) messages that should be rendered. Should be ordered by `receiveTime`,
  // and should be immediately following the previous array of messages that was emitted as part of
  // this state. If there is a discontinuity in messages, `lastSeekTime` should be different than
  // the previous state. Panels collect these messages using the `PanelAPI`.
  messages: readonly MessageEvent<unknown>[];
  totalBytesReceived: number; // always-increasing

  // The current playback position, which will be shown in the playback bar. This time should be
  // equal to or later than the latest `receiveTime` in `messages`. Why not just use
  // `last(messages).receiveTime`? The reason is that the data source (e.g. ROS bag) might have
  // empty sections, i.e. `messages` can be empty, but we still want to be able to show a playback
  // cursor moving forward during these regions.
  currentTime: Time;

  // The start time to show in the playback bar. Every `message.receiveTime` (and therefore
  // `currentTime`) has to later than or equal to `startTime`.
  startTime: Time;

  // The end time to show in the playback bar. Every `message.receiveTime` (and therefore
  // `currentTime`) has to before than or equal to `endTime`.
  endTime: Time;

  // Whether or not we're currently playing back. Controls the play/pause icon in the playback bar.
  // It's still allowed to emit `messages` even when not playing (e.g. when doing a backfill after
  // a seek).
  isPlaying: boolean;

  // If the Player supports non-real-time speeds (i.e. PlayerState#capabilities contains
  // PlayerCapabilities.setSpeed), this represents that speed as a fraction of real time.
  // E.g. 1.0 is real time, 0.2 is 20% of real time.
  speed: number;

  // The order in which messages are published.
  messageOrder: TimestampMethod;

  // The last time a seek / discontinuity in messages happened. This will clear out data within
  // `PanelAPI` so we're not looking at stale data.
  // TODO(JP): This currently is a time per `Date.now()`, but we don't need that anywhere, so we
  // should change this to a `resetMessagesId` where you just have to set it to a unique id (better
  // to have an id than a boolean, in case the listener skips parsing a state for some reason).
  lastSeekTime: number;

  // A list of topics that panels can subscribe to. This list may change across states,
  // but when a topic is removed from the list we should treat it as a seek (i.e. lastSeekTime
  // should be bumped). Also, no messages are allowed to be emitted which have a `topic` field that
  // isn't represented in this list. Finally, every topic must have a `datatype` which is actually
  // present in the `datatypes` field (see below).
  topics: Topic[];

  // A complete list of ROS datatypes. Allowed to change. But it must always be "complete" (every
  // topic must refer to a datatype that is present in this list, every datatypes that refers to
  // another datatype must refer to a datatype that is present in this list).
  datatypes: RosDatatypes;

  // A map of topic names to the set of publisher IDs publishing each topic.
  publishedTopics?: Map<string, Set<string>>;

  // A map of topic names to the set of subscriber IDs subscribed to each topic.
  subscribedTopics?: Map<string, Set<string>>;

  // A map of service names to service provider IDs that provide each service.
  services?: Map<string, Set<string>>;

  // A map of parameter names to parameter values, used to describe remote parameters such as
  // rosparams.
  parameters?: Map<string, ParameterValue>;

  // Used for late-parsing of binary messages. Required to cover any topic for which binary data is
  // given to panels. (May be empty for players that only provide messages parsed into objects.)
  parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic;
};

// Represents a ROS topic, though the actual data does not need to come from a ROS system.
export type Topic = {
  // Of ROS topic format, i.e. "/some/topic". We currently depend on this slashes format a bit in
  // `<MessageHistroy>`, though we could relax this and support arbitrary strings. It's nice to have
  // a consistent representation for topics that people recognize though.
  name: string;
  // Name of the datatype (see `type PlayerStateActiveData` for details).
  datatype: string;
  // The number of messages present on the topic. Valid only for sources with a fixed number of
  // messages, such as bags.
  numMessages?: number;
};

type RosSingularField = number | string | boolean | RosObject; // No time -- consider it a message.
export type RosValue =
  | RosSingularField
  | readonly RosSingularField[]
  | Uint8Array
  | Int8Array
  | undefined
  // eslint-disable-next-line no-restricted-syntax
  | null;

export type RosObject = Readonly<{
  [property: string]: RosValue;
}>;

// Contains different kinds of progress indications
export type Progress = Readonly<{
  // Indicate which ranges are loaded
  fullyLoadedFractionRanges?: Range[];

  // A raw view into the cached binary data stored by the MemoryCacheDataProvider. Only present when
  // using the RandomAccessPlayer.
  readonly messageCache?: BlockCache;
}>;

export type Frame = {
  [topic: string]: MessageEvent<unknown>[];
};

// Represents a subscription to a single topic, for use in `setSubscriptions`.
// TODO(JP): Pull this into two types, one for the Player (which does not care about the
// `requester`) and one for the Internals panel (which does).
export type SubscribePayload = {
  // The topic name to subscribe to.
  topic: string;

  // Optionally, where the request came from. Used in the "Internals" panel to improve debugging.
  requester?: { type: "panel" | "node" | "other"; name: string };
};

// Represents a single topic publisher, for use in `setPublishers`.
export type AdvertiseOptions = {
  // The topic name
  topic: string;

  // The datatype name
  datatype: string;

  // Additional advertise options
  options?: Record<string, unknown>;
};

// The actual message to publish.
export type PublishPayload = { topic: string; msg: Record<string, unknown> };

// Capabilities that are not shared by all players.
export const PlayerCapabilities = {
  // Publishing messages. Need to be connected to some sort of live robotics system (e.g. ROS).
  advertise: "advertise",

  // Setting speed to something that is not real time.
  setSpeed: "setSpeed",

  // Ability to play, pause, and seek in time.
  playbackControl: "playbackControl",

  // List and retrieve values for configuration key/value pairs
  getParameters: "getParameters",

  // Set values for configuration key/value pairs
  setParameters: "setParameters",
};

// A metrics collector is an interface passed into a `Player`, which will get called when certain
// events happen, so we can track those events in some metrics system.
export interface PlayerMetricsCollectorInterface {
  setProperty(key: string, value: string | number | boolean): void;
  playerConstructed(): void;
  initialized(): void;
  play(speed: number): void;
  seek(time: Time): void;
  setSpeed(speed: number): void;
  pause(): void;
  close(): void;
  setSubscriptions(subscriptions: SubscribePayload[]): void;
  recordBytesReceived(bytes: number): void;
  recordPlaybackTime(time: Time, params: { stillLoadingData: boolean }): void;
  recordDataProviderPerformance(metadata: AverageThroughput): void;
  recordUncachedRangeRequest(): void;
  recordTimeToFirstMsgs(): void;
  recordDataProviderInitializePerformance(metadata: InitializationPerformanceMetadata): void;
  recordDataProviderStall(metadata: RandomAccessDataProviderStall): void;
}
