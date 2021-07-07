// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const DEFAULT_PROTOS = {
  "http:": { port: 80 },
  "https:": { port: 443 },
  "ws:": { port: 80 },
  "wss:": { port: 443 },
};

// Parse a user-input string as a URL using a forgiving parser that interprets
// bare server names or server/port combos using the passed in default protocol
// and a map of protocols to default port numbers and a separate (optional)
// protocol name to rewrite to
export function parseInputUrl(
  str: string,
  defaultProtocol = "https:",
  protocols: { [proto: string]: { protocol?: string; port: number } } = DEFAULT_PROTOS,
): string | undefined {
  if (str.length === 0) {
    return undefined;
  }

  try {
    let url = new URL(str.includes("://") ? str : `${defaultProtocol}//${str}`);

    // Check if the protocol exists in the passed in map of allowed protocols
    const proto = protocols[url.protocol];
    if (proto == undefined) {
      return undefined;
    }

    if (proto.protocol != undefined) {
      url = new URL(url.href.replace(/(^\w+:|^)\/\//, `${proto.protocol}//`));
    }

    if (url.port.length === 0) {
      url.port = String(proto.port);
    }

    return url.toString();
  } catch {
    // The input still couldn't be parsed as a valid URL, reject it
    return undefined;
  }
}
