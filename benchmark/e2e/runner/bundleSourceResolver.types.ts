// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Types of the bundle source resolver (`runner/bundleSourceResolver.ts`).

/** Where a benchmark build's renderer scripts and their source maps live. */
export type BundleLayout = {
  /** Output directory of the renderer scripts and their external `.map` files. */
  buildDir: string;
  /** Webpack `context` of the build (the map `sources` are relative to it). */
  contextDir: string;
  /** Repository root: resolved sources are made relative to it. */
  repoRoot: string;
};

/** File access of the resolver (injected by the tests). */
export type BundleFileSystem = {
  exists: (filePath: string) => boolean;
  readText: (filePath: string) => string;
};
