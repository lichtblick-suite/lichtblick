// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type ExtensionPackageJson = {
  name: string;
  version: string;
  main: string;
  publisher?: string;
};

export type PackageName = {
  name: string;
  namespace?: string;
};
