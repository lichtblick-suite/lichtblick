// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { Immutable } from "@lichtblick/suite";
import { AppParametersEnum } from "@lichtblick/suite-base/AppParameters";

// Defines a type for input parameters, allowing any string keys with string values.
export type AppParametersInput = Readonly<Record<string, string>>;

// Defines a type for application parameters, restricting keys to the AppParametersEnum for type-safe usage.
export type AppParameters = Readonly<Record<AppParametersEnum, string | undefined>>;

export type AppParametersContext = Immutable<AppParameters>;

export const AppParametersContext = createContext<undefined | AppParametersContext>(undefined);

export function useAppParameters(): AppParameters {
  const context = useContext(AppParametersContext);
  if (context == undefined) {
    throw new Error("useAppParameters must be used within a AppParametersProvider");
  }
  return context;
}
