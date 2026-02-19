/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";

import { useSynchronousMountedState } from "./useSynchronousMountedState";

describe("useSynchronousMountedState", () => {
  it("tracks mounted state", () => {
    const { result, unmount, rerender } = renderHook(useSynchronousMountedState, {
      wrapper({ children }) {
        return <div>{children}</div>;
      },
    });
    expect(result.current()).toBeTruthy();
    rerender();
    expect(result.current()).toBeTruthy();
    unmount();
    expect(result.current()).toBeFalsy();
  });
});
