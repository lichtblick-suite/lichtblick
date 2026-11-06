/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader, McapWriter, TempBuffer } from "@mcap/core";
import { waitFor } from "@testing-library/react";
import { Blob } from "node:buffer";

import { PlayerState, PlayerPresence } from "@lichtblick/suite-base/players/types";

import { IterablePlayer } from "./IterablePlayer";
import { BlobReadable } from "./Mcap/BlobReadable";
import { McapIndexedIterableSource } from "./Mcap/McapIndexedIterableSource";
import { expandVideoSeekBackfill } from "./videoSeekBackfill";

async function synchronizedChannels(): Promise<Uint8Array> {
  const buffer = new TempBuffer();
  const writer = new McapWriter({ writable: buffer, startChannelId: 1 });
  const encoder = new TextEncoder();
  await writer.start({ library: "test", profile: "" });
  for (const name of ["foxglove.SceneUpdate", "foxglove.PointCloud"]) {
    const schemaId = await writer.registerSchema({
      name,
      encoding: "jsonschema",
      data: encoder.encode('{"type":"object","properties":{"value":{"type":"number"}}}'),
    });
    await writer.registerChannel({
      topic: "/mixed_geometry",
      messageEncoding: "json",
      schemaId,
      metadata: new Map(),
    });
  }
  for (const time of [1, 2, 3, 4]) {
    for (const channelId of [1, 2]) {
      await writer.addMessage({
        channelId,
        logTime: BigInt(time) * 1_000_000_000n,
        publishTime: 0n,
        sequence: time,
        data: encoder.encode(JSON.stringify({ value: channelId * 10 + time })),
      });
    }
  }
  await writer.end();
  return buffer.get();
}

it("preserves synchronized SceneUpdate and PointCloud channels across manual seeks", async () => {
  const bytes = await synchronizedChannels();
  const reader = await McapIndexedReader.Initialize({
    readable: new BlobReadable(new Blob([bytes]) as unknown as globalThis.Blob),
  });
  const player = new IterablePlayer({
    source: new McapIndexedIterableSource(reader),
    sourceId: "regression",
    enablePreload: false,
    expandBackfill: expandVideoSeekBackfill,
  });
  let latest: PlayerState | undefined;
  const frames: PlayerState[] = [];
  player.setSubscriptions([{ topic: "/mixed_geometry" }]);
  player.setListener(async (state) => {
    latest = state;
    frames.push(state);
  });
  try {
    await waitFor(() => { expect(latest?.presence).toBe(PlayerPresence.PRESENT); });
    for (const [sec, nsec] of [
      [2, 50_000_000],
      [3, 500_000_000],
      [1, 250_000_000],
      [3, 250_000_000],
    ]) {
      const target = { sec: sec!, nsec: nsec! };
      frames.length = 0;
      player.seekPlayback(target);
      await waitFor(() => {
        const frame = frames.find(
          (state) =>
            state.activeData?.currentTime.sec === target.sec &&
            state.activeData.currentTime.nsec === target.nsec &&
            state.activeData.messages.length > 0,
        );
        expect(frame?.activeData?.messages.map((event) => event.schemaName).sort()).toEqual([
          "foxglove.PointCloud",
          "foxglove.SceneUpdate",
        ]);
      });
    }
    frames.length = 0;
    player.setSubscriptions([{ topic: "/mixed_geometry", channelIds: ["mcap:2"] }]);
    player.seekPlayback({ sec: 2, nsec: 50_000_000 });
    await waitFor(() => {
      const frame = frames.find(
        (state) =>
          state.activeData?.currentTime.sec === 2 &&
          state.activeData.currentTime.nsec === 50_000_000 &&
          state.activeData.messages.length > 0,
      );
      expect(frame?.activeData?.messages.map((event) => event.channelId)).toEqual(["mcap:2"]);
    });
  } finally {
    player.close();
    await player.isClosed;
  }
});
