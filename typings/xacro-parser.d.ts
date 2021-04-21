// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// https://github.com/gkjohnson/xacro-parser/issues/54
declare module "xacro-parser" {
  declare const XacroParser: typeof import("xacro-parser/src/XacroParser").default;
  export { XacroParser };
}
