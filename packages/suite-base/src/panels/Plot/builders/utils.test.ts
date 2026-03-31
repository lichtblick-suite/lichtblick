// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { unwrap } from "@lichtblick/den/monads";
import { parseMessagePath } from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";
import { buildCurrentSeriesActions, buildFullSeriesActions, lastMatchingTopic } from "./utils";

function makeSeriesItem({
  key,
  value,
  ...rest
}: { key: string; value: string } & Partial<SeriesItem>): { config: SeriesItem } {
  const parsed = unwrap(parseMessagePath(value));
  return {
    config: {
      configIndex: 0,
      parsed,
      color: "red",
      contrastColor: "blue",
      enabled: true,
      timestampMethod: "receiveTime",
      key,
      lineSize: 1,
      messagePath: value,
      showLine: true,
      ...rest,
    },
  };
}

describe("lastMatchingTopic", () => {
  const matchTopic = BasicBuilder.string();
  const otherTopic = BasicBuilder.string();
  it("returns undefined for an empty array", () => {
    expect(lastMatchingTopic([], matchTopic)).toBeUndefined();
  });

  it("returns undefined when no event matches the topic", () => {
    const events = [
      MessageEventBuilder.messageEvent({ topic: otherTopic }),
      MessageEventBuilder.messageEvent({ topic: otherTopic }),
    ];
    expect(lastMatchingTopic(events, matchTopic)).toBeUndefined();
  });

  it("returns the last matching event", () => {
    const first = MessageEventBuilder.messageEvent({ topic: matchTopic, message: 1 });
    const second = MessageEventBuilder.messageEvent({ topic: matchTopic, message: 2 });
    const other = MessageEventBuilder.messageEvent({ topic: otherTopic, message: 3 });
    expect(lastMatchingTopic([first, second, other], matchTopic)).toBe(second);
  });

  it("ignores non-matching events that appear after the match", () => {
    const match = MessageEventBuilder.messageEvent({ topic: matchTopic, message: 1 });
    const after = MessageEventBuilder.messageEvent({ topic: otherTopic, message: 2 });
    expect(lastMatchingTopic([match, after], matchTopic)).toBe(match);
  });
});

describe("buildCurrentSeriesActions", () => {
  const seriesA = makeSeriesItem({ key: "a" as SeriesConfigKey, value: "/topic_a.field" });
  const seriesB = makeSeriesItem({ key: "b" as SeriesConfigKey, value: "/topic_b.field" });

  it("returns empty actions and no change when there are no series", () => {
    const result = buildCurrentSeriesActions([], { didSeek: false }, () => [1]);
    expect(result.actions).toEqual([]);
    expect(result.datasetsChanged).toBe(false);
  });

  it("emits only append-current actions when didSeek is false", () => {
    const items = [42];
    const result = buildCurrentSeriesActions([seriesA], { didSeek: false }, () => items);
    expect(result.actions).toEqual([{ type: "append-current", series: "a", items }]);
    expect(result.datasetsChanged).toBe(true);
  });

  it("emits reset-current before append-current when didSeek is true", () => {
    const items = [1, 2];
    const result = buildCurrentSeriesActions([seriesA], { didSeek: true }, () => items);
    expect(result.actions).toEqual([
      { type: "reset-current", series: "a" },
      { type: "append-current", series: "a", items },
    ]);
    expect(result.datasetsChanged).toBe(true);
  });

  it("handles multiple series, emitting actions in order", () => {
    const result = buildCurrentSeriesActions([seriesA, seriesB], { didSeek: false }, (config) =>
      config.key === "a" ? [1] : [2, 3],
    );
    expect(result.actions).toEqual([
      { type: "append-current", series: "a", items: [1] },
      { type: "append-current", series: "b", items: [2, 3] },
    ]);
    expect(result.datasetsChanged).toBe(true);
  });

  it("sets datasetsChanged to false when all series return empty items", () => {
    const result = buildCurrentSeriesActions([seriesA, seriesB], { didSeek: false }, () => []);
    expect(result.datasetsChanged).toBe(false);
    expect(result.actions).toEqual([
      { type: "append-current", series: "a", items: [] },
      { type: "append-current", series: "b", items: [] },
    ]);
  });

  it("sets datasetsChanged to true when at least one series has items", () => {
    const result = buildCurrentSeriesActions([seriesA, seriesB], { didSeek: false }, (config) =>
      config.key === "b" ? [99] : [],
    );
    expect(result.datasetsChanged).toBe(true);
  });

  it("passes the series config to getItems", () => {
    const captured: Immutable<SeriesItem>[] = [];
    buildCurrentSeriesActions([seriesA, seriesB], { didSeek: false }, (config) => {
      captured.push(config);
      return [];
    });
    expect(captured).toEqual([seriesA.config, seriesB.config]);
  });

  it("emits reset-current for every series when didSeek is true with multiple series", () => {
    const result = buildCurrentSeriesActions([seriesA, seriesB], { didSeek: true }, () => []);
    expect(result.actions).toEqual([
      { type: "reset-current", series: "a" },
      { type: "append-current", series: "a", items: [] },
      { type: "reset-current", series: "b" },
      { type: "append-current", series: "b", items: [] },
    ]);
  });
});

describe("buildFullSeriesActions", () => {
  const topic = `/${BasicBuilder.string()}`;
  const otherTopic = `/${BasicBuilder.string()}`;
  const seriesA = makeSeriesItem({ key: "a" as SeriesConfigKey, value: `${topic}.field` });
  const seriesB = makeSeriesItem({ key: "b" as SeriesConfigKey, value: `${otherTopic}.field` });

  it("returns empty actions when there are no series", () => {
    const result = buildFullSeriesActions([], topic, { isReset: false }, () => [1]);
    expect(result).toEqual([]);
  });

  it("emits only append-full for a matching topic with items", () => {
    const items = [42];
    const result = buildFullSeriesActions([seriesA], topic, { isReset: false }, () => items);
    expect(result).toEqual([{ type: "append-full", series: "a", items }]);
  });

  it("emits reset-full before append-full when isReset is true", () => {
    const items = [1, 2];
    const result = buildFullSeriesActions([seriesA], topic, { isReset: true }, () => items);
    expect(result).toEqual([
      { type: "reset-full", series: "a" },
      { type: "append-full", series: "a", items },
    ]);
  });

  it("emits only reset-full when isReset is true and getItems returns empty", () => {
    const result = buildFullSeriesActions([seriesA], topic, { isReset: true }, () => []);
    expect(result).toEqual([{ type: "reset-full", series: "a" }]);
  });

  it("skips series whose topic does not match", () => {
    const result = buildFullSeriesActions([seriesB], topic, { isReset: false }, () => [1]);
    expect(result).toEqual([]);
  });

  it("passes the series config to getItems", () => {
    const captured: Immutable<SeriesItem>[] = [];
    buildFullSeriesActions([seriesA, seriesB], topic, { isReset: false }, (config) => {
      captured.push(config);
      return [];
    });
    expect(captured).toEqual([seriesA.config]);
  });

  it("emits no append-full when getItems returns empty and isReset is false", () => {
    const result = buildFullSeriesActions([seriesA], topic, { isReset: false }, () => []);
    expect(result).toEqual([]);
  });
});
