// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as IDB from "idb/with-async-ittr";

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

export interface LayoutsDB extends IDB.DBSchema {
  layouts: {
    key: [namespace: string, id: LayoutID];
    value: {
      namespace: string;
      layout: Layout;
    };
    indexes: {
      namespace: string;
    };
  };
}
