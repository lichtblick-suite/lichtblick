// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";

/**
 * isLayoutEqual compares two LayoutData instances for "equality". If the two instances are
 * considered "equal" then the function returns true. If the two instances are not equal it returns
 * false.
 *
 * The comparison is intentionally additive-lenient in two dimensions:
 *
 * 1. Top-level non-configById fields: extra undefined fields in b are ignored.
 * 2. configById (panel configs): two levels of additive tolerance are applied.
 *    a. New panel IDs in b that were not in a are ignored — a panel can be added to the
 *       mosaic but its first saveConfig call is not a user edit.
 *    b. New config keys in b's panel config that were not in a's panel config are ignored —
 *       panels populate their own default config keys during initialization, and treating
 *       those additions as user edits would create false "unsaved changes" indicators on
 *       shared/team layouts.
 *
 * Existing keys that are present in a and have a different value in b (including removal,
 * i.e., the key is absent in b) are always treated as real differences.
 */
export function isLayoutEqual(baseline: LayoutData, current: LayoutData): boolean {
  const { configById: configByIdBaseline, ...restBaseline } = baseline;
  const { configById: configByIdCurrent, ...restCurrent } = current;

  // All top-level fields other than configById must be deeply equal.
  // Strip keys whose value is undefined in current so extra undefined entries don't
  // register as differences (preserving the original behaviour).
  const strippedRestCurrent = _.omitBy(restCurrent, _.isUndefined);
  if (!_.isEqual(_.omitBy(restBaseline, _.isUndefined), strippedRestCurrent)) {
    return false;
  }

  // For configById, only check panel IDs that existed in the baseline (a).
  // New panel entries added by panel initialization are not considered user edits.
  for (const panelId of Object.keys(configByIdBaseline)) {
    const panelConfigBaseline = configByIdBaseline[panelId] ?? {};
    const panelConfigCurrent = configByIdCurrent[panelId] ?? {};

    // For each key in the baseline panel config, check it still has the same value.
    // New keys added to current's panel config are ignored (panel default initialization).
    for (const configKey of Object.keys(panelConfigBaseline)) {
      if (!_.isEqual(panelConfigBaseline[configKey], panelConfigCurrent[configKey])) {
        return false;
      }
    }
  }

  return true;
}
