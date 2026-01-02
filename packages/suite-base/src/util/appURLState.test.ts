// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time, toRFC3339String } from "@lichtblick/rostime";
import {
  AppURLState,
  updateAppURLState,
  parseAppURLState,
} from "@lichtblick/suite-base/util/appURLState";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockIsDesktop = isDesktopApp as jest.MockedFunction<typeof isDesktopApp>;

describe("app state url parser", () => {
  // Note that the foxglove URL here is different from actual foxglove URLs because Node's URL parser
  // interprets lichtblick:// URLs differently than the browser does.
  describe.each([
    { isDesktop: true, urlBuilder: () => new URL("lichtblick://host/open") },
    { isDesktop: false, urlBuilder: () => new URL("https://studio.foxglove.dev/") },
  ])("url tests", ({ isDesktop, urlBuilder }) => {
    beforeEach(() => mockIsDesktop.mockReturnValue(isDesktop));
    it("rejects non data state urls", () => {
      expect(parseAppURLState(urlBuilder())).toBeUndefined();
    });

    it("parses rosbag data state urls", () => {
      const url = urlBuilder();
      url.searchParams.append("ds", "ros1-remote-bagfile");
      url.searchParams.append("ds.url", "http://example.com");

      expect(parseAppURLState(url)).toMatchObject({
        ds: "ros1-remote-bagfile",
        dsParams: {
          url: "http://example.com",
        },
      });
    });

    it("parses multiple remote data state urls to a single string", () => {
      const url = urlBuilder();
      url.searchParams.append("ds", "remote-file");
      url.searchParams.append("ds.url", "http://example1.com");
      url.searchParams.append("ds.url", "http://example2.com");

      expect(parseAppURLState(url)).toMatchObject({
        ds: "remote-file",
        dsParams: {
          url: "http://example1.com,http://example2.com",
        },
      });
    });

    it("parses handles duplicate dsParams correctly", () => {
      const url = urlBuilder();
      url.searchParams.append("ds", "remote-file");
      url.searchParams.append("ds.url", "http://example1.com");
      url.searchParams.append("ds.test", "test1");
      url.searchParams.append("ds.test", "test2");

      expect(parseAppURLState(url)).toMatchObject({
        ds: "remote-file",
        dsParams: {
          url: "http://example1.com",
          test: "test2",
        },
      });
    });

    it("parses data platform state urls", () => {
      const now: Time = { sec: new Date().getTime(), nsec: 0 };
      const time = toRFC3339String({ sec: now.sec + 500, nsec: 0 });
      const start = toRFC3339String(now);
      const end = toRFC3339String({ sec: now.sec + 1000, nsec: 0 });
      const url = urlBuilder();
      url.searchParams.append("ds", "foo");
      url.searchParams.append("time", time);
      url.searchParams.append("ds.bar", "barValue");
      url.searchParams.append("ds.baz", "bazValue");
      url.searchParams.append("ds.start", start);
      url.searchParams.append("ds.end", end);
      url.searchParams.append("ds.eventId", "dummyEventId");

      const parsed = parseAppURLState(url);
      expect(parsed).toMatchObject({
        ds: "foo",
        time: { sec: now.sec + 500, nsec: 0 },
        dsParams: { bar: "barValue", baz: "bazValue" },
      });
    });
  });
});

describe("updateAppURLState", () => {
  const baseURL = new URL(`http://${BasicBuilder.string()}.com`);

  it("encodes rosbag urls", () => {
    const url = `${baseURL.origin}/${BasicBuilder.string()}.bag`;
    const urlState: AppURLState = {
      time: undefined,
      ds: "ros1-remote-bagfile",
      dsParams: { url },
    };

    const result = updateAppURLState(baseURL, urlState);

    expect(decodeURIComponent(result.href)).toEqual(
      `${baseURL.origin}/?ds=${urlState.ds}&ds.url=${url}`,
    );
  });

  it("should encode multiple remote files urls", () => {
    const urls = [
      `${baseURL.origin}/${BasicBuilder.string()}.mcap`,
      `${baseURL.origin}/${BasicBuilder.string()}.mcap`,
    ];
    const urlState: AppURLState = {
      time: undefined,
      ds: "remote-file",
      dsParamsArray: { urls },
    };

    const result = updateAppURLState(baseURL, urlState);

    expect(decodeURIComponent(result.href)).toEqual(
      `${baseURL.origin}/?ds=${urlState.ds}&ds.url=${urls[0]}&ds.url=${urls[1]}`,
    );
  });

  it("appends 'ds.' + key when keyMap entry doesn't have a substitute for that key", () => {
    const key = BasicBuilder.string();
    const paramArray: string[] = BasicBuilder.strings({ count: 2 });
    const urlState: AppURLState = {
      time: undefined,
      ds: "remote-file",
      dsParamsArray: { [key]: paramArray },
    };

    const result = updateAppURLState(baseURL, urlState);

    expect(result.href).toEqual(
      `${baseURL.origin}/?ds=${urlState.ds}&ds.${key}=${paramArray[0]}&ds.${key}=${paramArray[1]}`,
    );
  });

  describe("url states", () => {
    const eventId = BasicBuilder.string();
    const time = undefined;
    it.each<AppURLState>([
      {
        time,
        ds: "ros1",
        dsParams: {
          url: `${baseURL.origin}:${baseURL.port}/${BasicBuilder.string()}.bag`,
          eventId,
        },
      },
      {
        time,
        ds: "ros2",
        dsParams: {
          url: `${baseURL.origin}:${baseURL.port}/${BasicBuilder.string()}.bag`,
          eventId,
        },
      },
      {
        time,
        ds: "ros1-remote-bagfile",
        dsParams: { url: `${baseURL.origin}/${BasicBuilder.string()}.bag`, eventId },
      },
      {
        time,
        ds: "rosbridge-websocket",
        dsParams: {
          url: `ws://${baseURL.host}:${baseURL.port}/${BasicBuilder.string()}.bag`,
          eventId,
        },
      },
    ])("encodes url state", (state) => {
      const url = state.dsParams?.url;
      const encodedURLFile = encodeURIComponent(url ?? "");

      const result = updateAppURLState(baseURL, state);

      expect(result.href).toEqual(
        `${baseURL.origin}/?ds=${state.ds}&ds.eventId=${eventId}&ds.url=${encodedURLFile}`,
      );
    });
  });
});
