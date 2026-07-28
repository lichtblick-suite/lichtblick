// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";

/**
 * Wire types for an additional (secondary) data source delivered alongside a session.
 *
 * This is the session-API analog of issue #1045's `SecondarySourceProvider`: the **source side**
 * (e.g. an external HTTP service) is responsible for producing the topics, schemas and the
 * already-serialized messages. This repository only transports, decodes and merges them onto the
 * player timeline — it never constructs message content itself.
 *
 * Binary payloads (`schemaData`, message `data`) are base64-encoded so the descriptor is plain JSON
 * and structured-clonable across the worker boundary.
 *
 * This module is intentionally limited to leaf types (no player imports) so it can be referenced
 * from both the player and transport (session API) layers without creating import cycles.
 */

/**
 * A topic contributed by an additional source, carrying everything the standard deserialization
 * pipeline needs to decode the topic's messages.
 */
type AdditionalSourceTopic = {
  name: string;
  schemaName: string;
  /** Well-known message encoding, e.g. "json", "cdr", "protobuf", "ros1". */
  messageEncoding: string;
  /** Well-known schema encoding, e.g. "jsonschema", "ros2msg", "protobuf". Omit for schemaless json. */
  schemaEncoding?: string;
  /** Base64-encoded schema bytes. Omit for schemaless json. */
  schemaData?: string;
};

/** A single, already-serialized message produced by the additional source side. */
type AdditionalSourceMessage = {
  topic: string;
  /** Log/receive time. */
  receiveTime: Time;
  /** Publish time. Defaults to {@link receiveTime} when omitted. */
  publishTime?: Time;
  /** Base64-encoded, already-serialized message bytes. */
  data: string;
};

/**
 * Self-describing additional data source delivered with a session.
 *
 * Mirrors `SecondarySourceProvider`: it declares its own topics/schemas and supplies the messages,
 * so the player can construct an `ISerializedIterableSource` from it generically.
 */
export type AdditionalSourceDescriptor = {
  /** Unique identifier for this source (used in alerts/diagnostics). */
  id: string;
  topics: AdditionalSourceTopic[];
  messages: AdditionalSourceMessage[];
};
