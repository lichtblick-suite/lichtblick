/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";

import useRethrow from "./useRethrow";

describe("useRethrow", () => {
  it("should catch errors thrown", () => {
    let error: Error | undefined;
    const { result } = renderHook(
      () => {
        return useRethrow(() => {
          throw new Error("foobar");
        });
      },
      {
        wrapper: class Wrapper extends React.Component<React.PropsWithChildren<unknown>> {
          public override componentDidCatch(err: Error) {
            error = err;
          }
          public override render() {
            return this.props.children;
          }
        },
      },
    );

    act(() => {
      result.current();
    });
    expect(error?.message).toEqual("foobar");
  });
});
