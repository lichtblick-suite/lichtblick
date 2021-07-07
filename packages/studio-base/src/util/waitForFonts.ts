// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

// Workaround for code using measureText during initial render. Even if the font data is available
// immediately (because we use a data: url), Chrome doesn't parse/load it until it's "used" on the
// page, which we can trigger by adding a dummy element with some text.
//
// Without waiting, initial measureText calls have the wrong result, and the font sometimes doesn't
// appear in screenshot tests.

export default async function waitForFonts(): Promise<unknown> {
  return await Promise.all([...document.fonts].map(async (font) => await font.load()));
}
