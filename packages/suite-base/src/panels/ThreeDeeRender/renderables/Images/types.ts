// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265ParserContext } from "@lichtblick/den/video";

/**
 * Discriminator returned alongside each prepared video frame so callers can branch on the parse
 * result without doing string-equality on the human-readable `diagnostics` message.
 */
export enum PreparedVideoFrameStatus {
  /** Frame is decodable and should be sent to the VideoPlayer. */
  Ok = "ok",
  /** Frame uses a bitstream variant we cannot parse (e.g. unrecognized H.265 framing). */
  UnsupportedBitstream = "unsupported-bitstream",
  /** Frame is an H.265 B-frame, which the renderer skips because we render in capture order. */
  UnsupportedBFrame = "unsupported-b-frame",
}

export type PreparedVideoFrame = {
  data: Uint8Array;
  decoderConfig?: VideoDecoderConfig;
  /** Human-readable detail about the parse outcome — for logs and error UI only. */
  diagnostics?: string;
  status: PreparedVideoFrameStatus;
  type: "key" | "delta";
};

export type PrepareVideoFrameContext = {
  h265?: H265ParserContext;
};
