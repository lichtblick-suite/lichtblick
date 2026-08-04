// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IterableSourceInitializeArgs } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

// Shared multi-file hydration overrides passed through to MultiIterableSource.
export type MultiFileHydrationOverrides = Pick<
  IterableSourceInitializeArgs,
  "maxHydratedSources" | "maxHydratedBytes" | "initConcurrency"
>;

// Pick only the hydration overrides that are explicitly defined.
export function pickDefinedHydrationOverrides(
  source: MultiFileHydrationOverrides,
): Partial<MultiFileHydrationOverrides> {
  return {
    ...(source.maxHydratedSources != undefined
      ? { maxHydratedSources: source.maxHydratedSources }
      : {}),
    ...(source.maxHydratedBytes != undefined ? { maxHydratedBytes: source.maxHydratedBytes } : {}),
    ...(source.initConcurrency != undefined ? { initConcurrency: source.initConcurrency } : {}),
  };
}

// Merge defined multi-file hydration overrides on top of existing init args.
export function addMultiFileHydrationOverrides<T extends object>(
  initArgs: T,
  overrides?: MultiFileHydrationOverrides,
): T & Partial<MultiFileHydrationOverrides> {
  if (overrides == undefined) {
    return initArgs;
  }

  return {
    ...initArgs,
    ...pickDefinedHydrationOverrides(overrides),
  };
}
