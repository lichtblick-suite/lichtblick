// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";
import { Immutable, MessageEvent, Metadata, ParameterValue } from "@lichtblick/suite";
import { BuiltinPanelExtensionContext } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { IteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import {
  AdvertiseOptions,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

type ResumeFrame = () => void;
export type MessagePipelineContext = Immutable<{
  playerState: PlayerState;
  sortedTopics: Topic[];
  sortedServices: string[];
  datatypes: RosDatatypes;
  subscriptions: SubscribePayload[];
  messageEventsBySubscriberId: Map<string, MessageEvent[]>;
  setSubscriptions: (id: string, subscriptionsForId: Immutable<SubscribePayload[]>) => void;
  setPublishers: (id: string, publishersForId: AdvertiseOptions[]) => void;
  setParameter: (key: string, value: ParameterValue) => void;
  publish: (request: PublishPayload) => void;
  getMetadata: () => ReadonlyArray<Readonly<Metadata>>;
  callService: (service: string, request: unknown) => Promise<unknown>;
  fetchAsset: BuiltinPanelExtensionContext["unstable_fetchAsset"];
  startPlayback?: () => void;
  pausePlayback?: () => void;
  playUntil?: (time: Time) => void;
  setPlaybackSpeed?: (speed: number) => void;
  seekPlayback?: (time: Time) => void;
  // Don't render the next frame until the returned function has been called.
  pauseFrame: (name: string) => ResumeFrame;
  getBatchIterator: (topic: string) => AsyncIterableIterator<Readonly<IteratorResult>> | undefined;
}>;
