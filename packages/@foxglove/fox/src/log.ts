// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export function info(message: unknown, ...args: unknown[]): void {
  // eslint-disable-next-line no-restricted-syntax
  console.log(message, ...args);
}

export function fatal(message: unknown, ...args: unknown[]): void {
  console.error(message, ...args);
  process.exit(1);
}
