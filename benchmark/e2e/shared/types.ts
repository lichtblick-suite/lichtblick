// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** An executable (absolute path) and its arguments, run without a shell. */
export type ExecutableCommand = {
  command: string;
  args: string[];
};
