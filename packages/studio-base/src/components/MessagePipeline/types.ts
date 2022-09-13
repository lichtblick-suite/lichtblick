// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";
import { MessageEvent, ParameterValue } from "@foxglove/studio";
import {
  AdvertiseOptions,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

type ResumeFrame = () => void;
export type MessagePipelineContext = {
  playerState: PlayerState;
  sortedTopics: Topic[];
  datatypes: RosDatatypes;
  subscriptions: SubscribePayload[];
  publishers: AdvertiseOptions[];
  messageEventsBySubscriberId: Map<string, MessageEvent<unknown>[]>;
  setSubscriptions: (id: string, subscriptionsForId: SubscribePayload[]) => void;
  setPublishers: (id: string, publishersForId: AdvertiseOptions[]) => void;
  setParameter: (key: string, value: ParameterValue) => void;
  publish: (request: PublishPayload) => void;
  callService: (service: string, request: unknown) => Promise<unknown>;
  startPlayback?: () => void;
  pausePlayback?: () => void;
  playUntil?: (time: Time) => void;
  setPlaybackSpeed?: (speed: number) => void;
  seekPlayback?: (time: Time) => void;
  // Don't render the next frame until the returned function has been called.
  pauseFrame: (name: string) => ResumeFrame;
};
