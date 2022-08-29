// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const colors = {
  DARK: "#08080a",
  DARK4: "#2d2d33",
  LIGHT1: "#f0f0f0",
  PURPLE1: "#6858f5",
  BLUE: "#248eff",
  YELLOW1: "#eba800",
  RED1: "#db3553",
  HIGHLIGHT: "#29bee7",
  TEXT_MUTED: "rgba(247, 247, 243, 0.3)",
};

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
