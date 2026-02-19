// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import { DiagnosticInfo } from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { LEVELS } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import { DiagnosticsById } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import { getDiagnosticsWithStales } from "@lichtblick/suite-base/panels/DiagnosticSummary/utils/getDiagnosticsWithStales";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("getDiagnosticsWithStales", () => {
  const staleTime = RosTimeBuilder.time({ sec: 100, nsec: 0 });

  const createDiagnosticInfo = (stamp: Time, level = 1): DiagnosticInfo => {
    return DiagnosticsBuilder.info({
      stamp,
      status: {
        ...DiagnosticsBuilder.statusMessage(),
        level,
      },
    });
  };

  it("should mark diagnostics as STALE when stamp is older than staleTime", () => {
    // Given
    const id = BasicBuilder.string();
    const oldTime = RosTimeBuilder.time({ sec: 50, nsec: 0 });
    const diagnostic = createDiagnosticInfo(oldTime, 2);
    const diagnosticsByName: DiagnosticsById = new Map([[id, diagnostic]]);

    const hardwareId = BasicBuilder.string();
    const diagnosticsByHardwareId = new Map([[hardwareId, diagnosticsByName]]);

    // When
    const result = getDiagnosticsWithStales(diagnosticsByHardwareId, staleTime);

    // Then
    const updatedDiagnostic = result.get(hardwareId)?.get(id);
    expect(updatedDiagnostic).toBeDefined();
    expect(updatedDiagnostic?.status.level).toBe(LEVELS.STALE);
  });

  it("should keep original level when stamp is newer than staleTime", () => {
    // Given
    const id = BasicBuilder.string();
    const recentTime = RosTimeBuilder.time({ sec: 150, nsec: 0 });
    const diagnostic = createDiagnosticInfo(recentTime, 3);
    const diagnosticsByName: DiagnosticsById = new Map([[id, diagnostic]]);
    const hardwareId = BasicBuilder.string();
    const diagnosticsByHardwareId = new Map([[hardwareId, diagnosticsByName]]);

    // When
    const result = getDiagnosticsWithStales(diagnosticsByHardwareId, staleTime);

    // Then
    const updatedDiagnostic = result.get(hardwareId)?.get(id);
    expect(updatedDiagnostic).toBeDefined();
    expect(updatedDiagnostic?.status.level).toBe(3);
  });

  it("should preserve all hardwareId and diagnostic names", () => {
    // Given
    const time1 = RosTimeBuilder.time({ sec: 10, nsec: 0 });
    const time2 = RosTimeBuilder.time({ sec: 200, nsec: 0 });
    const diagnosticInfo1 = createDiagnosticInfo(time1, 1); // become stale
    const diagnosticInfo2 = createDiagnosticInfo(time2, 4); // keep level

    const id1 = BasicBuilder.string();
    const id2 = BasicBuilder.string();
    const diagnosticById1: DiagnosticsById = new Map([[id1, diagnosticInfo1]]);
    const diagnosticById2: DiagnosticsById = new Map([[id2, diagnosticInfo2]]);

    const hardwareId1 = BasicBuilder.string();
    const hardwareId2 = BasicBuilder.string();
    const diagnostics = new Map([
      [hardwareId1, diagnosticById1],
      [hardwareId2, diagnosticById2],
    ]);

    // When
    const result = getDiagnosticsWithStales(diagnostics, staleTime);

    // Then
    expect(result.size).toBe(2);
    expect(result.get(hardwareId1)?.get(id1)?.status.level).toBe(LEVELS.STALE);
    expect(result.get(hardwareId2)?.get(id2)?.status.level).toBe(4);
  });
});
