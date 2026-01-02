// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ReactNode, useCallback } from "react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { getItemString } from "@lichtblick/suite-base/util/getItemString";

export default function useGetItemStringWithTimezone(): (
  type: string,
  data: unknown,
  itemType: ReactNode,
  itemString: string,
) => ReactNode {
  const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
  return useCallback(
    (type: string, data: unknown, itemType: ReactNode, itemString: string) =>
      getItemString(type, data, itemType, itemString, [], timezone),
    [timezone],
  );
}
