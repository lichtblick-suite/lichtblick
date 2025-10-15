// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { main } from "@lichtblick/suite-web";
import { layouts } from "@lichtblick/suite-web/src/layouts";

const url = new URL(window.location.href);
let layoutName = url.searchParams.get("layout");

// If layout is not found at root level, check if it's inside ds.url parameter
if (!layoutName) {
  const dsUrl = url.searchParams.get("ds.url");
  if (dsUrl) {
    try {
      const dsUrlObj = new URL(dsUrl);
      layoutName = dsUrlObj.searchParams.get("layout");
    } catch (e) {
      console.log("Could not parse ds.url:", dsUrl);
    }
  }
}

const requestedLayout = layoutName ? layouts[layoutName] : undefined;

console.log("URL layout parameter:", layoutName);
console.log("Available layouts:", Object.keys(layouts));
console.log("Requested layout:", requestedLayout);
console.log("Full URL:", window.location.href);
console.log("Manual layout:", layouts["manual"]);
console.log("Auto layout:", layouts["auto"]);

if (requestedLayout) {
  (window as any).LICHTBLICK_SUITE_DEFAULT_LAYOUT = requestedLayout;
  console.log("Set LICHTBLICK_SUITE_DEFAULT_LAYOUT:", requestedLayout);
}

void main();
