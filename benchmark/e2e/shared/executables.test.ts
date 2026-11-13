// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  GIT_EXECUTABLE_CANDIDATES,
  LINUX_XDG_OPEN_PATH,
  MACOS_OPEN_PATH,
  PS_EXECUTABLE_CANDIDATES,
} from "./constants";
import { findExecutable, openFileCommand } from "./executables";

describe("findExecutable", () => {
  it("returns the first existing candidate", () => {
    // Given
    const existing = new Set(["/usr/bin/ps"]);

    // When
    const found = findExecutable(PS_EXECUTABLE_CANDIDATES, (file) => existing.has(file));

    // Then
    expect(found).toBe("/usr/bin/ps");
  });

  it("prefers earlier candidates when several exist", () => {
    // Given
    const existing = new Set(["/bin/ps", "/usr/bin/ps"]);

    // When
    const found = findExecutable(PS_EXECUTABLE_CANDIDATES, (file) => existing.has(file));

    // Then
    expect(found).toBe("/bin/ps");
  });

  it("returns undefined when no candidate exists", () => {
    // Given
    const exists = () => false;

    // When
    const found = findExecutable(GIT_EXECUTABLE_CANDIDATES, exists);

    // Then
    expect(found).toBeUndefined();
  });

  it("only lists absolute candidates", () => {
    // Given
    const candidates = [...PS_EXECUTABLE_CANDIDATES, ...GIT_EXECUTABLE_CANDIDATES];

    // When
    const relative = candidates.filter((candidate) => !candidate.startsWith("/"));

    // Then
    expect(relative).toEqual([]);
  });
});

describe("openFileCommand", () => {
  it("uses /usr/bin/open on macOS", () => {
    // Given
    const file = "/tmp/report/index.html";

    // When
    const command = openFileCommand(file, "darwin", {});

    // Then
    expect(command).toEqual({ command: MACOS_OPEN_PATH, args: [file] });
    expect(MACOS_OPEN_PATH).toBe("/usr/bin/open");
  });

  it("uses /usr/bin/xdg-open on Linux", () => {
    // Given
    const file = "/tmp/report/index.html";

    // When
    const command = openFileCommand(file, "linux", {});

    // Then
    expect(command).toEqual({ command: LINUX_XDG_OPEN_PATH, args: [file] });
    expect(LINUX_XDG_OPEN_PATH).toBe("/usr/bin/xdg-open");
  });

  it("uses cmd.exe from %SystemRoot%\\System32 on Windows", () => {
    // Given
    const file = String.raw`C:\artifacts\report\index.html`;

    // When
    const command = openFileCommand(file, "win32", { SystemRoot: String.raw`C:\Windows` });

    // Then
    expect(command).toEqual({
      command: String.raw`C:\Windows\System32\cmd.exe`,
      args: ["/c", "start", "", file],
    });
  });

  it("returns undefined on Windows without SystemRoot", () => {
    // Given
    const file = String.raw`C:\artifacts\report\index.html`;

    // When
    const missing = openFileCommand(file, "win32", {});
    const empty = openFileCommand(file, "win32", { SystemRoot: "" });

    // Then
    expect(missing).toBeUndefined();
    expect(empty).toBeUndefined();
  });
});
