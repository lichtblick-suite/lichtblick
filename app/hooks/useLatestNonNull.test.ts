// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import useLatestNonNull from "@foxglove/studio-base/hooks/useLatestNonNull";

describe("useLatestNonNull", () => {
  it("returns latest value if not null", () => {
    const { result, rerender } = renderHook((props) => useLatestNonNull(props), {
      // eslint-disable-next-line no-restricted-syntax
      initialProps: 0 as number | null | undefined,
    });
    expect(result.current).toBe(0);
    rerender(1);
    expect(result.current).toBe(1);
    rerender(undefined);
    expect(result.current).toBe(1);
    rerender(null); // eslint-disable-line no-restricted-syntax
    expect(result.current).toBe(1);
    rerender(2);
    expect(result.current).toBe(2);
    rerender(undefined);
    expect(result.current).toBe(2);
  });

  it("handles undefined as initial value", () => {
    const { result, rerender } = renderHook((props?: number) => useLatestNonNull(props));
    expect(result.current).toBeUndefined();
    rerender(1);
    expect(result.current).toBe(1);
    rerender(undefined);
    expect(result.current).toBe(1);
  });
});
