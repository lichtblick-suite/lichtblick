// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isReferenceLinePlotPathType } from "./config";

describe("isReferenceLinePlotPathType", () => {
  it.each(["0", "1.2", "1e6"])("returns true for '%s'", (value) => {
    expect(
      isReferenceLinePlotPathType({ value, enabled: true, timestampMethod: "receiveTime" }),
    ).toBe(true);
  });

  it.each([
    "",
    "x",
    "x.y",
    ".y",
    '/tf{child_frame_id=="base_link"}',
    '"topic with spaces"."field with spaces"',
  ])("returns false for '%s'", (value) => {
    expect(
      isReferenceLinePlotPathType({ value, enabled: true, timestampMethod: "receiveTime" }),
    ).toBe(false);
  });
});
