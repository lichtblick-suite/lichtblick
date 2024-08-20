/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { screen } from "@testing-library/react";

import { createSyncRoot } from "@lichtblick/suite-base/panels/createSyncRoot";

describe("createSyncRoot", () => {
  const originalError = console.error;

  beforeAll(() => {
    // Supress specific warning about ReactDOM.render
    console.error = (...args) => {
      if (args[0]?.includes("Warning: ReactDOM.render is no longer supported") === true) {
        return;
      }
      originalError.call(console, ...args);
    };
  });

  afterAll(() => {
    // Restore original console.error after tests
    console.error = originalError;
  });

  it("should mount the component", async () => {
    const textTest = "Mount Component Test";
    const TestComponent = () => <div>{textTest}</div>;

    const container = document.createElement("div");
    document.body.appendChild(container);

    createSyncRoot(<TestComponent />, container);

    expect(await screen.findByText(textTest)).toBeDefined();
  });

  it("should unmount the component", () => {
    const textTest = "Unmount Component Test";
    const TestComponent = () => <div>{textTest}</div>;

    const container = document.createElement("div");
    document.body.appendChild(container);

    const unmountCb = createSyncRoot(<TestComponent />, container);
    expect(screen.queryAllByText(textTest)).toHaveLength(1);

    unmountCb();
    expect(screen.queryAllByText(textTest)).toHaveLength(0);
  });
});
