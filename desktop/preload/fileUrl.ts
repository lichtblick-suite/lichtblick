// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { resolve } from "path";

// Converts a filesystem path such as "/home/user/Documents/myfile" or
// "C:\Users\user\Documents\myfile" to a file: URI such as "file:///home/user/Documents/myfile" or
// "file:///C:/Users/user/Documents/myfile"
export function fileUrl(filePath: string): string {
  if (typeof filePath !== "string") {
    throw new TypeError(`Expected a string, got ${typeof filePath}`);
  }

  let pathName = resolve(filePath);
  pathName = pathName.replace(/\\/g, "/");

  // Windows drive letter must be prefixed with a slash
  if (pathName[0] !== "/") {
    pathName = `/${pathName}`;
  }

  // Escape required characters for path components.
  // See: https://tools.ietf.org/html/rfc3986#section-3.3
  return encodeURI(`file://${pathName}`).replace(/[?#]/g, encodeURIComponent);
}
