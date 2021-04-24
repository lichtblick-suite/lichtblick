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

import UrlSearchParams from "url-search-params";
import util from "util";

import { resetLogEventForTests } from "@foxglove-studio/app/util/logEvent";

process.env.WASM_LZ4_ENVIRONMENT = "NODE";

function noOp() {
  // no-op
}

if (typeof window.URL.createObjectURL === "undefined") {
  Object.defineProperty(window.URL, "createObjectURL", { value: noOp });
}

if (typeof window !== "undefined") {
  global.TextDecoder = util.TextDecoder as typeof TextDecoder;
  // polyfill URLSearchParams in jsdom
  window.URLSearchParams = UrlSearchParams;
}

global.TextEncoder = util.TextEncoder;

// React available everywhere (matches webpack config)
global.React = require("react");

// Jest does not include ResizeObserver.
class ResizeObserverMock {
  private _callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this._callback = callback;
  }

  disconnect() {}

  observe() {
    const entry: any = {
      contentRect: { width: 150, height: 150 },
    };
    this._callback([entry], this);
  }

  unobserve() {}
}

global.ResizeObserver = ResizeObserverMock;

// Set logEvent up with a default implementation
resetLogEventForTests();
