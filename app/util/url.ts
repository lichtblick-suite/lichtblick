// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import URL from "url-parse";

// Parse a user-input string as a URL using a forgiving parser that interprets
// bare server names or server/port combos using an assumed default protocol
export function parseInputUrl(str?: string, defaultProtocol = "https:"): string | undefined {
  if (str == undefined || str.length === 0) {
    return undefined;
  }
  if (str.indexOf("://") === -1) {
    str = `${defaultProtocol}//${str}`;
  }
  try {
    const url = new URL(str);
    return url.toString();
  } catch {
    // The input still couldn't be parsed as a valid URL, reject it
    return undefined;
  }
}
