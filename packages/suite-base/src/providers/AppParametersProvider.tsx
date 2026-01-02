// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import {
  AppParameters,
  AppParametersContext,
  AppParametersInput,
} from "@lichtblick/suite-base/context/AppParametersContext";

type Props = PropsWithChildren<{
  appParameters?: AppParametersInput;
}>;

/**
 * AppParametersProvider:
 *
 * This component provides a context for application parameters within the Lichtblick ecosystem.
 *
 * Type Safety:
 *   The `appParameters` input is cast to the `AppParameters` type, ensuring that keys align with
 *   the expected enumeration. This guarantees proper autocomplete and type-checking for developers.
 */
export default function AppParametersProvider({
  children,
  appParameters = {},
}: Props): React.JSX.Element {
  const parameters: AppParameters = useMemo(() => appParameters, [appParameters]);
  return (
    <AppParametersContext.Provider value={parameters}>{children}</AppParametersContext.Provider>
  );
}
