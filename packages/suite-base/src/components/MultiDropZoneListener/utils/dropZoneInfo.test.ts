// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DropZoneType } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";
import { generateDropZoneHelpMessage } from "@lichtblick/suite-base/components/MultiDropZoneListener/utils/dropZoneInfo";

describe("generateDropZoneHelpMessage", () => {
  it("should return correct help message for local zone", () => {
    const type: DropZoneType = "local";

    const message = generateDropZoneHelpMessage(type);

    expect(message).toContain("Drop extension files or layout configurations for local use");
    expect(message).toContain(".json");
    expect(message).toContain(".foxe");
  });

  it("should return correct help message for organization zone", () => {
    const type: DropZoneType = "org";

    const message = generateDropZoneHelpMessage(type);

    expect(message).toContain(
      "Drop extension files or layout configurations for organization-wide use",
    );
    expect(message).toContain(".json");
    expect(message).toContain(".foxe");
  });

  it("should return correct help message for source zone", () => {
    const type: DropZoneType = "source";

    const message = generateDropZoneHelpMessage(type);

    expect(message).toContain("Drop data files to analyze and visualize");
    expect(message).toContain(".mcap");
    expect(message).toContain(".bag");
    expect(message).toContain(".db3");
    expect(message).toContain(".ulg");
    expect(message).toContain(".ulog");
  });

  it("should return complete message format", () => {
    const localMessage = generateDropZoneHelpMessage("local");
    const orgMessage = generateDropZoneHelpMessage("org");
    const sourceMessage = generateDropZoneHelpMessage("source");

    expect(localMessage).toMatch(/^.+\. Supported formats: .+\.$/);
    expect(orgMessage).toMatch(/^.+\. Supported formats: .+\.$/);
    expect(sourceMessage).toMatch(/^.+\. Supported formats: .+\.$/);
  });
});
