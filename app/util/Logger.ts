// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

const showLogs = process.env.NODE_ENV !== "test" || process.env.SHOW_TEST_OUTPUT;

export default class Logger {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  debug(message: string, ...args: any[]) {
    if (showLogs) {
      console.debug(this.name, message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (showLogs) {
      // eslint-disable-next-line no-restricted-syntax
      console.info(this.name, message, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (showLogs) {
      console.warn(this.name, message, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (showLogs) {
      console.error(this.name, message, ...args);
    }
  }

  log(level: "debug" | "info" | "warn" | "error", message: string, ...args: any[]) {
    switch (level) {
      case "debug":
        return this.debug(message, ...args);
      case "info":
        return this.info(message, ...args);
      case "warn":
        return this.warn(message, ...args);
      case "error":
        return this.error(message, ...args);
    }
    throw new Error(`Unknown level: ${level}`);
  }
}
