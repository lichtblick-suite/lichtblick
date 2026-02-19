/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { act, screen, waitFor } from "@testing-library/react";

import { createSyncRoot } from "@lichtblick/suite-base/panels/createSyncRoot";

describe("createSyncRoot", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should mount the component", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const text = "Mount Component Test";
    const TestComponent = () => <div>{text}</div>;
    act(() => {
      createSyncRoot(<TestComponent />, container);
    });

    expect(container.innerHTML).toContain(text);
    await expect(screen.findByText(text)).resolves.not.toBeUndefined();
  });

  it("should unmount the component", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const text = "Unmount Component Test";
    const TestComponent = () => <div>{text}</div>;
    act(() => {
      const unmount = createSyncRoot(<TestComponent />, container);
      queueMicrotask(() => {
        unmount();
      });
    });

    await waitFor(() => {
      expect(container.innerHTML).not.toContain(text);
      expect(screen.queryByText(text)).toBeNull();
    });
  });
});
