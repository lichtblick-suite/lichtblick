// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Binary wire format of the Foxglove SDK `playbackControl` capability. Not yet part of
// @foxglove/ws-protocol, see rust/foxglove/src/protocol/common/{client,server} in
// https://github.com/foxglove/foxglove-sdk

import { Time } from "@lichtblick/rostime";

export const PLAYBACK_CONTROL_CAPABILITY = "playbackControl";
const CLIENT_PLAYBACK_CONTROL_REQUEST_OPCODE = 0x03;
export const SERVER_PLAYBACK_STATE_OPCODE = 0x05;

export enum PlaybackStatus {
  Playing = 0,
  Paused = 1,
  Buffering = 2,
  Ended = 3,
}

/** Extra `serverInfo` fields sent by servers that advertise `playbackControl`. */
export type PlaybackServerInfo = {
  dataStartTime?: Time;
  dataEndTime?: Time;
};

export type PlaybackControlRequest = {
  play: boolean;
  speed: number;
  seekTimeNs?: bigint;
  requestId: string;
};

export type PlaybackState = {
  status: PlaybackStatus;
  currentTimeNs: bigint;
  speed: number;
  didSeek: boolean;
  requestId: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodePlaybackControlRequest(req: PlaybackControlRequest): ArrayBuffer {
  const requestId = textEncoder.encode(req.requestId);
  const buffer = new ArrayBuffer(1 + 1 + 4 + 1 + 8 + 4 + requestId.byteLength);
  const view = new DataView(buffer);
  view.setUint8(0, CLIENT_PLAYBACK_CONTROL_REQUEST_OPCODE);
  view.setUint8(1, req.play ? 0 : 1);
  view.setFloat32(2, req.speed, true);
  view.setUint8(6, req.seekTimeNs == undefined ? 0 : 1);
  view.setBigUint64(7, req.seekTimeNs ?? 0n, true);
  view.setUint32(15, requestId.byteLength, true);
  new Uint8Array(buffer, 19).set(requestId);
  return buffer;
}

const PLAYBACK_STATE_HEADER_LENGTH = 19;

/** True for a well-formed playback state frame; malformed frames fall through to FoxgloveClient. */
export function isPlaybackStateMessage(data: unknown): data is ArrayBuffer {
  if (!(data instanceof ArrayBuffer) || data.byteLength < PLAYBACK_STATE_HEADER_LENGTH) {
    return false;
  }
  const view = new DataView(data);
  return (
    view.getUint8(0) === SERVER_PLAYBACK_STATE_OPCODE &&
    PLAYBACK_STATE_HEADER_LENGTH + view.getUint32(15, true) <= data.byteLength
  );
}

export function decodePlaybackState(buffer: ArrayBuffer): PlaybackState {
  const view = new DataView(buffer);
  const requestIdLength = view.getUint32(15, true);
  return {
    status: view.getUint8(1),
    currentTimeNs: view.getBigUint64(2, true),
    speed: view.getFloat32(10, true),
    didSeek: view.getUint8(14) !== 0,
    requestId: textDecoder.decode(new Uint8Array(buffer, PLAYBACK_STATE_HEADER_LENGTH, requestIdLength)),
  };
}
