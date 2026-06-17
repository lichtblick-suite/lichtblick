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
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@testing-library/jest-dom";

import Table from "./Table";

describe("Table", () => {
  it("should render values for simple keys", () => {
    // Given
    const value = [{ fieldName: "visible-value" }];

    // When
    render(<Table value={value} accessorPath="" />);

    // Then
    expect(screen.getByTestId("column-header-fieldName")).toBeVisible();
    expect(screen.getByText("visible-value")).toBeVisible();
  });

  it("should render values for top-level keys that contain dots", () => {
    // Given
    const value = [{ "field.with.dot": "visible-value" }];

    // When
    render(<Table value={value} accessorPath="" />);

    // Then
    expect(screen.getByTestId("column-header-field-with-dot")).toBeVisible();
    expect(screen.getByText("visible-value")).toBeVisible();
  });

  it("should render values for nested keys that contain dots after expanding", async () => {
    // Given
    const value = [{ outer: { "inner.with.dot": "nested-visible-value" } }];

    // When
    const user = userEvent.setup();
    render(<Table value={value} accessorPath="" />);
    await user.click(screen.getByTestId("expand-cell-outer-0"));

    // Then
    expect(screen.getByTestId("column-header-inner-with-dot")).toBeVisible();
    expect(screen.getByText("nested-visible-value")).toBeVisible();
  });
});
