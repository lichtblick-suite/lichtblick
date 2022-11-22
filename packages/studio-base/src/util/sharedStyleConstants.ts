// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const fonts = {
  // We explicitly avoid fallback fonts (such as 'monospace') here to work around a bug in
  // Chrome/Chromium on Windows that causes crashes when multiple Workers try to access fonts that
  // have not yet been loaded. There is a race against the internal DirectWrite font cache which
  // ends up crashing in DWriteFontFamily::GetFirstMatchingFont() or DWriteFont::Create().
  //
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1261577
  MONOSPACE: "'IBM Plex Mono'",
  SANS_SERIF: "'Inter'",
  SANS_SERIF_FEATURE_SETTINGS:
    // enable font features https://rsms.me/inter/lab
    "'cv08', 'cv10', 'tnum'",
};
