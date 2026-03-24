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
 * Layout instances are considered equal if all non-configById fields are identical (extra undefined
 * fields in b are ignored), and all pre-existing configById keys in _a_ are unchanged in _b_. New
 * entries added to _b_'s configById that were not present in _a_ are ignored — panels legitimately
 * populate their own default config keys during initialization, and treating those additions as user
 * edits would create false "unsaved changes" indicators on shared/team layouts.
 */
export function isLayoutEqual(a: LayoutData, b: LayoutData): boolean {
  const { configById: configByIdA, ...restA } = a;
  const { configById: configByIdB, ...restB } = b;

  // All top-level fields other than configById must be deeply equal.
  // Strip keys whose value is undefined in b so extra undefined entries don't
  // register as differences (preserving the original behaviour).
  const strippedRestB = _.omitBy(restB, _.isUndefined);
  if (!_.isEqual(_.omitBy(restA, _.isUndefined), strippedRestB)) {
    return false;
  }

  // For configById, only check keys that existed in the baseline (a).
  // Panel initialization may add new keys to b; those are not user edits.
  for (const key of Object.keys(configByIdA)) {
    if (!_.isEqual(configByIdA[key], configByIdB[key])) {
      return false;
    }
  }

  return true;
}
