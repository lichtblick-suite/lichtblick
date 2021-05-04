// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Tells typescript how to understand scss imports. Scss files are processed via webpack loaders.

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}
