// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export enum ALLOWED_FILES {
  EXTENSION = "dist/extension.js",
  PACKAGE = "package.json",
  README = "README.md",
  CHANGELOG = "CHANGELOG.md",
}

export type PackageName = {
  name: string;
  publisher?: string;
};
