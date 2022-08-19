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

import setImmediate from "@foxglove/studio-base/util/setImmediate";

process.env.WASM_LZ4_ENVIRONMENT = "NODE";

function noOp() {
  // no-op
}

if (typeof window !== "undefined") {
  global.TextDecoder = util.TextDecoder as typeof TextDecoder;
  // polyfill URLSearchParams in jsdom
  window.URLSearchParams = UrlSearchParams;

  if (typeof window.URL.createObjectURL === "undefined") {
    Object.defineProperty(window.URL, "createObjectURL", { value: noOp });
  }

  // jsdom removes Node's setImmediate from global, but we have tests & app code that use it
  // https://github.com/facebook/jest/pull/11222
  (window as { setImmediate?: typeof setImmediate }).setImmediate ??= setImmediate;
}

global.TextEncoder = util.TextEncoder;

// React available everywhere (matches webpack config)
global.React = require("react");

// Jest does not include ResizeObserver.
class ResizeObserverMock {
  private _callback: ResizeObserverCallback;

  public constructor(callback: ResizeObserverCallback) {
    this._callback = callback;
  }

  public disconnect() {}

  public observe() {
    const entry = {
      contentRect: { width: 150, height: 150 },
    };
    this._callback([entry as ResizeObserverEntry], this);
  }

  public unobserve() {}
}

global.ResizeObserver = ResizeObserverMock;
