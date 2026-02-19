/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";
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
        wrapper: class Wrapper extends React.Component<React.PropsWithChildren> {
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
