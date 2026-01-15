// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This is injected by DefinePlugin from the webpack config that builds these files
declare const LICHTBLICK_PRODUCT_NAME: string;
declare const LICHTBLICK_PRODUCT_VERSION: string;
declare const LICHTBLICK_PRODUCT_HOMEPAGE: string;

const productName = LICHTBLICK_PRODUCT_NAME;
const version = LICHTBLICK_PRODUCT_VERSION;
const homepage = LICHTBLICK_PRODUCT_HOMEPAGE;

export {
  homepage as LICHTBLICK_PRODUCT_HOMEPAGE,
  productName as LICHTBLICK_PRODUCT_NAME,
  version as LICHTBLICK_PRODUCT_VERSION,
};
