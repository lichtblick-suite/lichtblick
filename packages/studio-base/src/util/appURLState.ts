// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { fromRFC3339String, toRFC3339String, Time } from "@foxglove/rostime";

export type AppURLState = {
  ds?: string;
  dsParams?: Record<string, string>;
  time?: Time;
};

/**
 * Encodes app state in a URL's query params.
 *
 * @param url The base URL to encode params into.
 * @param urlState The player state to encode.
 * @returns A url with all app state stored as query pararms.
 */
export function updateAppURLState(url: URL, urlState: AppURLState): URL {
  const newURL = new URL(url.href);

  if ("time" in urlState) {
    if (urlState.time) {
      newURL.searchParams.set("time", toRFC3339String(urlState.time));
    } else {
      newURL.searchParams.delete("time");
    }
  }

  if ("ds" in urlState) {
    if (urlState.ds) {
      newURL.searchParams.set("ds", urlState.ds);
    } else {
      newURL.searchParams.delete("ds");
    }
  }

  if ("dsParams" in urlState) {
    [...newURL.searchParams].forEach(([k]) => {
      if (k.startsWith("ds.")) {
        newURL.searchParams.delete(k);
      }
    });

    Object.entries(urlState.dsParams ?? "").forEach(([k, v]) => {
      newURL.searchParams.set("ds." + k, v);
    });
  }

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
  const ds = url.searchParams.get("ds") ?? undefined;
  const timeString = url.searchParams.get("time");
  const time = timeString == undefined ? undefined : fromRFC3339String(timeString);
  const dsParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k && v && k.startsWith("ds.")) {
      const cleanKey = k.replace(/^ds./, "");
      dsParams[cleanKey] = v;
    }
  });

  const state: AppURLState = _.omitBy(
    {
      time,
      ds,
      dsParams: _.isEmpty(dsParams) ? undefined : dsParams,
    },
    _.isEmpty,
  );

  return _.isEmpty(state) ? undefined : state;
}
