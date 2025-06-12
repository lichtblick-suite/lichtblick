// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import PlexMono from "@lichtblick/suite-base/styles/assets/PlexMono.woff2";

// Explicitly load the "Plex Mono" font, since custom fonts from the main renderer are not inherited
// by web workers. This is required to draw "Plex Mono" on an OffscreenCanvas, and it also appears
// to fix a crash a large portion of Windows users were seeing where the rendering thread would
// crash in skia code related to DirectWrite font loading when the system display scaling is set
// >100%. For more info on this crash, see util/waitForFonts.ts.
export async function loadDefaultFont(): Promise<FontFace> {
  // Passing a `url(data:...) format('woff2')` string does not work in Safari, which complains it
  // cannot load the data url due to it being cross-origin.
  // https://bugs.webkit.org/show_bug.cgi?id=265000
  const fontFace = new FontFace("IBM Plex Mono", await (await fetch(PlexMono)).arrayBuffer());
  if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    (self as unknown as WorkerGlobalScope).fonts.add(fontFace);
  } else {
    document.fonts.add(fontFace);
  }

  return await fontFace.load();
}
