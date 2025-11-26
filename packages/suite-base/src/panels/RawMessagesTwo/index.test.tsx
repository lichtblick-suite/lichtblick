/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL-2.0/

import "@testing-library/jest-dom";

import { RAW_MESSAGES_TWO_DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/RawMessagesTwo/constants";
import RawMessagesTwoPanelExport from "@lichtblick/suite-base/panels/RawMessagesTwo/index";

describe("RawMessagesTwo Panel Export", () => {
  describe("when verifying panel registration", () => {
    it("should export panel with correct panelType", () => {
      // Given / When
      const panel = RawMessagesTwoPanelExport;

      // Then
      expect(panel.panelType).toBe("RawMessagesTwo");
    });

    it("should export panel with default config", () => {
      // Given / When
      const panel = RawMessagesTwoPanelExport;

      // Then
      expect(panel.defaultConfig).toEqual(RAW_MESSAGES_TWO_DEFAULT_CONFIG);
    });

    it("should export panel as wrapped component", () => {
      // Given / When
      const panel = RawMessagesTwoPanelExport;

      // Then
      expect(panel).toBeDefined();
      expect(panel.panelType).toBeDefined();
      expect(panel.defaultConfig).toBeDefined();
    });
  });
});
