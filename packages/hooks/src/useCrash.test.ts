/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";
import * as React from "react";

import { useCrash } from "./useCrash";

describe("useCrash", () => {
  it("should re-throw the error", () => {
    let error: Error | undefined;
    const { result } = renderHook(() => useCrash(), {
      wrapper: class Wrapper extends React.Component<React.PropsWithChildren> {
        public override componentDidCatch(err: Error) {
          error = err;
        }
        public override render() {
          return this.props.children;
        }
      },
    });

    act(() => {
      result.current(new Error("my error"));
    });
    expect(error?.message).toEqual("my error");
  });
});
