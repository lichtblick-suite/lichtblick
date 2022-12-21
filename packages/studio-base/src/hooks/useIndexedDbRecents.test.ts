/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";

import useIndexedDbRecents from "@foxglove/studio-base/hooks/useIndexedDbRecents";

describe("useIndexedDbRecents", () => {
  it("empty recents on mount", () => {
    const { result, unmount } = renderHook(() => useIndexedDbRecents());
    expect(result.current.recents).toEqual([]);
    unmount();
  });

  it("adding a recent immediately should save it", async () => {
    // The first hook is used to addRecent immediately. This happens before the database recents have loaded
    {
      const { result, unmount } = renderHook(() => useIndexedDbRecents());
      expect(result.current.recents).toEqual([]);

      await act(() => {
        result.current.addRecent({
          sourceId: "foo",
          title: "my-title",
          type: "connection",
          extra: {
            foo: "bar",
          },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      unmount();
    }

    // This hooks should be able to load the recent added above before recents were loaded
    {
      const { result, unmount } = renderHook(() => useIndexedDbRecents());
      expect(result.current.recents).toEqual([]);

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.recents).toEqual([
        {
          id: expect.any(String),
          sourceId: "foo",
          title: "my-title",
          type: "connection",
          extra: {
            foo: "bar",
          },
        },
      ]);

      unmount();
    }
  });
});
