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

/**
 * Wait for the browser to load custom fonts that have already been added to the document (via CSS
 * or the FontFace API) and generic font families.
 */
export default async function waitForFonts(): Promise<unknown> {
  // A bug in Chrome/Chromium on Windows causes crashes when multiple Workers try to access fonts
  // (including custom fonts and generic fallback families) that have not yet been loaded. There is
  // a race against the internal DirectWrite font cache which ends up crashing in
  // DWriteFontFamily::GetFirstMatchingFont() or DWriteFont::Create().
  //
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1261577
  //
  // As a workaround, we can force the browser to load the font here, before any workers are
  // created, by adding a dummy element to the document. The `font.load()` call works for custom
  // fonts, but generic families are not exposed in `[...document.fonts]`.
  const genericFamilyNames = [
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
  ];
  for (const family of genericFamilyNames) {
    const div = document.createElement("div");
    div.textContent = "x";
    div.style.fontFamily = family;
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    document.body.append(div);
    setTimeout(() => div.remove(), 0);
  }

  return await Promise.all([...document.fonts].map(async (font) => await font.load()));
}
