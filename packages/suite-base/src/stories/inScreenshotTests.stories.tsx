// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import inScreenshotTests from "@lichtblick/suite-base/stories/inScreenshotTests";

export default {
  title: "inScreenshotTests",
};

export const InScreenshotTests: StoryObj = {
  render: () => {
    return (
      <div
        style={{
          padding: "20px",
          fontSize: "20px",
          color: "white",
          backgroundColor: inScreenshotTests() ? "green" : "maroon",
        }}
      >
        inScreenshotTests: {JSON.stringify(inScreenshotTests())}
      </div>
    );
  },
};
