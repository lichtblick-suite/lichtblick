// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromRFC3339String, toRFC3339String, Time } from "@foxglove/rostime";
import { LayoutID } from "@foxglove/studio-base/index";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

export type AppURLState = {
  ds: string;
  dsParams: Record<string, string>;
  layoutId: LayoutID | undefined;
  time: Time | undefined;
};

/**
 * Encodes app state in a URL's query params.
 *
 * @param url The base URL to encode params into.
 * @param urlState The player state to encode.
 * @returns A url with all app state stored as query pararms.
 */
export function encodeAppURLState(url: URL, urlState: AppURLState): URL {
  const newURL = new URL(url.href);

  // Clear all exisiting params first.
  [...newURL.searchParams].forEach(([k, _]) => newURL.searchParams.delete(k));

  if (urlState.layoutId) {
    newURL.searchParams.set("layoutId", urlState.layoutId);
  }

  if (urlState.time) {
    newURL.searchParams.set("time", toRFC3339String(urlState.time));
  }

  newURL.searchParams.set("ds", urlState.ds);
  Object.entries(urlState.dsParams).forEach(([k, v]) => {
    newURL.searchParams.set("ds." + k, v);
  });

  newURL.searchParams.sort();

  return newURL;
}

/**
 * Tries to parse a state url into one of the types we know how to open.
 *
 * @param url URL to try to parse.
 * @returns Parsed URL type or undefined if the url is not a valid URL.
 * @throws Error if URL parsing fails.
 */
export function parseAppURLState(url: URL): AppURLState | undefined {
  const ds = url.searchParams.get("ds");
  if (!ds) {
    return undefined;
  }

  if (isDesktopApp() && url.protocol !== "foxglove:") {
    throw Error("Unknown protocol.");
  }

  if (!isDesktopApp() && url.pathname !== "/") {
    throw Error("Unknown path.");
  }

  const layoutId = url.searchParams.get("layoutId");
  const timeString = url.searchParams.get("time");
  const time = timeString == undefined ? undefined : fromRFC3339String(timeString);
  const dsParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k && v && k.startsWith("ds.")) {
      const cleanKey = k.replace(/^ds./, "");
      dsParams[cleanKey] = v;
    }
  });

  return {
    layoutId: layoutId ? (layoutId as LayoutID) : undefined,
    time,
    ds,
    dsParams,
  };
}

/**
 * Tries to parse app url state from the window's current location.
 */
export function windowAppURLState(): AppURLState | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return parseAppURLState(new URL(window.location.href));
  } catch {
    return undefined;
  }
}

/**
 * Checks to see if we have a valid state encoded in the url.
 *
 * @returns True if the window has a valid encoded url state.
 */
export function windowHasValidURLState(): boolean {
  const urlState = windowAppURLState();
  return urlState != undefined;
}
