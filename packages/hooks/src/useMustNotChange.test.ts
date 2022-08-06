/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import Logger from "@foxglove/log";

import { useMustNotChangeImpl } from "./useMustNotChange";

describe("useMustNotChange", () => {
  it("should log an error when value changes", () => {
    const errorMock = jest.fn();
    Logger.channels().forEach((channel) => {
      if (channel.name().endsWith("useMustNotChange.ts")) {
        channel.error = errorMock;
      }
    });

    const { rerender } = renderHook((val) => useMustNotChangeImpl(val), {
      initialProps: 1,
    });
    rerender(2);

    expect(errorMock).toHaveBeenCalled();
  });
});
