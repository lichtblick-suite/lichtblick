// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { debounce } from "lodash";

export function arrayToPoint(
  v?: [number, number, number],
): { x: number; y: number; z: number } | undefined {
  if (!v) {
    return undefined;
  }
  return { x: v[0], y: v[1], z: v[2] };
}

// returns the linear interpolation between a and b based on unit-range variable t
export function lerp(t: number, a: number, b: number): number {
  // Clamp t to (0, 1)
  t = Math.min(Math.max(t, 0.0), 1.0);
  if (a === b) {
    return a;
  }
  return a + t * (b - a);
}

// the following regex captures characters allowed in the value of a kv-pair in the query component
// of a URI, minus "&" and "+" because they are handled specially by browsers.
//   https://tools.ietf.org/html/rfc3986
//   query = *( pchar / "/" / "?" )
//   pchar = unreserved / pct-encoded / sub-delims / ":" / "@"
const QUERY_REGEXP = /([a-zA-Z0-9\-._~!$'()*,;=:@/?])|./gu;

// percent-encode a parameter for the query portion of a URL.
// leaves certain characters un-escaped that the URLSearchParams class does not,
// to improve readability of the URL.
export function encodeURLQueryParamValue(value: string): string {
  return value.replace(QUERY_REGEXP, (char, allowedChar) => {
    return allowedChar || encodeURIComponent(char);
  });
}

// extra boundary added for jest testing, since jsdom's Blob doesn't support .text()
export function downloadTextFile(text: string, fileName: string) {
  return downloadFiles([{ blob: new Blob([text]), fileName }]);
}

export function downloadFiles(files: { blob: Blob; fileName: string }[]) {
  const { body } = document;
  if (!body) {
    return;
  }

  const link = document.createElement("a");
  link.style.display = "none";
  body.appendChild(link);

  const urls = files.map((file) => {
    const url = window.URL.createObjectURL(file.blob);
    link.setAttribute("download", file.fileName);
    link.setAttribute("href", url);
    link.click();
    return url;
  });

  // remove the link after triggering download
  window.requestAnimationFrame(() => {
    body.removeChild(link);
    urls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
  });
}

// Equivalent to `number % modulus`, but always returns a positive number (given that modulus is
// a positive number). This is the same as the `%` in e.g. Python.
// See https://stackoverflow.com/a/4467559 and https://en.wikipedia.org/wiki/Modulo_operation
export function positiveModulo(number: number, modulus: number): number {
  return ((number % modulus) + modulus) % modulus;
}

// Object.values returns mixed[], which is difficult to get Flow to accept.
export function objectValues<T>(o: { [s: string]: T } | ArrayLike<T>): T[] {
  return Object.values(o);
}

// Used when we want to limit some log rate, but the log contents depend on the combined contents
// of each event (like a sum).
export const debounceReduce = <A, T>({
  action,
  // Debounced function
  wait,
  reducer,
  // Combining/mapping function for action's argument
  initialValue,
}: {
  action: (arg0: A) => void;
  wait: number;
  reducer: (arg0: A, arg1: T) => A;
  initialValue: A;
}): ((arg0: T) => void) => {
  let current = initialValue;
  const debounced = debounce(
    () => {
      action(current);
      current = initialValue;
    },
    wait,
    { leading: true, trailing: true },
  );
  return (next: T) => {
    current = reducer(current, next);
    debounced();
  };
};
