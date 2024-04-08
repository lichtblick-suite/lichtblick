// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This is injected by DefinePlugin from the webpack config that builds these files
declare const FOXGLOVE_PRODUCT_NAME: string;
declare const FOXGLOVE_PRODUCT_VERSION: string;
declare const FOXGLOVE_PRODUCT_HOMEPAGE: string;

const productName = FOXGLOVE_PRODUCT_NAME;
const version = FOXGLOVE_PRODUCT_VERSION;
const homepage = FOXGLOVE_PRODUCT_HOMEPAGE;

export {
  productName as FOXGLOVE_PRODUCT_NAME,
  version as FOXGLOVE_PRODUCT_VERSION,
  homepage as FOXGLOVE_PRODUCT_HOMEPAGE,
};
