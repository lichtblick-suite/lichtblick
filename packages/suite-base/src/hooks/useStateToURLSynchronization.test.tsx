/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { renderHook } from "@testing-library/react";
import { ReactNode } from "react";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { useStateToURLSynchronization } from "@lichtblick/suite-base/hooks/useStateToURLSynchronization";
import EventsProvider from "@lichtblick/suite-base/providers/EventsProvider";

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext");
jest.mock("@lichtblick/suite-base/components/MessagePipeline");

describe("useStateToURLSynchronization", () => {
  it("updates the url with a stable source & player state", () => {
    const spy = jest.spyOn(window.history, "replaceState");

    (useMessagePipeline as jest.Mock).mockImplementation((selector) =>
      selector({
        playerState: {
          activeData: {
            currentTime: { sec: 1, nsec: 1 },
          },
          capabilities: ["playbackControl"],
          urlState: {
            sourceId: "test-source",
            parameters: { a: "one", b: "two" },
          },
        },
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <EventsProvider>{children}</EventsProvider>
    );

    const { rerender } = renderHook(useStateToURLSynchronization, { wrapper });

    expect(spy).toHaveBeenCalledWith(
      undefined,
      "",
      "http://localhost/?time=1970-01-01T00%3A00%3A01.000000001Z",
    );
    expect(spy).toHaveBeenLastCalledWith(
      undefined,
      "",
      "http://localhost/?ds=test-source&ds.a=one&ds.b=two&time=1970-01-01T00%3A00%3A01.000000001Z",
    );

    (useMessagePipeline as jest.Mock).mockImplementation((selector) =>
      selector({
        playerState: {
          activeData: {
            currentTime: { sec: 10, nsec: 10 },
          },
          capabilities: ["playbackControl"],
          urlState: {
            sourceId: "test-source2",
            parameters: { b: "two", c: "three" },
          },
        },
      }),
    );
    rerender();
    expect(spy).toHaveBeenLastCalledWith(
      undefined,
      "",
      "http://localhost/?ds=test-source2&ds.b=two&ds.c=three&time=1970-01-01T00%3A00%3A01.000000001Z",
    );
  });

  it("keeps a data-source url that carries its own query string intact", () => {
    // A GCS signed URL brings &X-Goog-Signature= and friends with it. The address bar used to
    // be written through decodeURIComponent, which unescaped those into the page's own query
    // string: ds.url came back truncated at its first & and the reloaded tab could not
    // authenticate. Reparsing what we hand to replaceState must give the url back unchanged.
    const signed =
      "https://storage.googleapis.com/bucket/x.mcap?X-Goog-Algorithm=GOOG4-RSA-SHA256" +
      "&X-Goog-Credential=sa%40p.iam.gserviceaccount.com%2F20260914%2Fauto%2Fstorage%2Fgoog4_request" +
      "&X-Goog-Expires=43200&X-Goog-Signature=deadbeef";
    const spy = jest.spyOn(window.history, "replaceState");

    (useMessagePipeline as jest.Mock).mockImplementation((selector) =>
      selector({
        playerState: {
          activeData: { currentTime: { sec: 1, nsec: 1 } },
          capabilities: ["playbackControl"],
          urlState: {
            sourceId: "remote-file",
            parameters: { urls: [signed] },
          },
        },
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <EventsProvider>{children}</EventsProvider>
    );
    renderHook(useStateToURLSynchronization, { wrapper });

    const written = spy.mock.calls[spy.mock.calls.length - 1]![2] as string;
    const reparsed = new URL(written);

    expect(reparsed.searchParams.get("ds.url")).toBe(signed);
    // the url's own params must not have leaked out to the page's query string
    expect(reparsed.searchParams.get("X-Goog-Signature")).toBeNull();
  });

  it("suppresses ds param writeback when mcap-bundle is present in the URL", () => {
    const spy = jest.spyOn(window.history, "replaceState");

    // Set the URL to include mcap-bundle
    window.history.pushState({}, "", "http://localhost/?mcap-bundle=test-session-123");

    (useMessagePipeline as jest.Mock).mockImplementation((selector) =>
      selector({
        playerState: {
          activeData: {
            currentTime: { sec: 5, nsec: 0 },
          },
          capabilities: ["playbackControl"],
          urlState: {
            sourceId: "remote-file",
            parameters: { url: "http://example.com/file.mcap" },
          },
        },
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <EventsProvider>{children}</EventsProvider>
    );

    renderHook(useStateToURLSynchronization, { wrapper });

    // Should only write time, not ds params
    const calls = spy.mock.calls;
    const lastCallUrl = calls[calls.length - 1]?.[2] as string | undefined;
    expect(lastCallUrl).not.toContain("ds=remote-file");
    expect(lastCallUrl).not.toContain("ds.url=");
  });

  it("writes ds params when mcap-bundle is present but empty in the URL", () => {
    const spy = jest.spyOn(window.history, "replaceState");

    // Set the URL to include an empty mcap-bundle value
    window.history.pushState({}, "", "http://localhost/?mcap-bundle=");

    (useMessagePipeline as jest.Mock).mockImplementation((selector) =>
      selector({
        playerState: {
          activeData: {
            currentTime: { sec: 5, nsec: 0 },
          },
          capabilities: ["playbackControl"],
          urlState: {
            sourceId: "remote-file",
            parameters: { url: "http://example.com/file.mcap" },
          },
        },
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <EventsProvider>{children}</EventsProvider>
    );

    renderHook(useStateToURLSynchronization, { wrapper });

    // Should write ds params normally since mcap-bundle has no value
    const calls = spy.mock.calls;
    const lastCallUrl = calls[calls.length - 1]?.[2] as string | undefined;
    expect(lastCallUrl).toContain("ds=remote-file");
    expect(lastCallUrl).toContain("ds.url=");
  });
});
