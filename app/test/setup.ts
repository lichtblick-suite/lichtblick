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
import ws from "ws";

import { resetLogEventForTests } from "@foxglove-studio/app/util/logEvent";

import MemoryStorage from "./MemoryStorage";

process.env.WASM_LZ4_ENVIRONMENT = "NODE";

function noOp() {
  // no-op
}

if (typeof window.URL.createObjectURL === "undefined") {
  Object.defineProperty(window.URL, "createObjectURL", { value: noOp });
}

if (typeof window !== "undefined") {
  // make sure window.localStorage exists
  (window as any).localStorage = window.localStorage || new MemoryStorage();

  global.requestAnimationFrame = window.requestAnimationFrame =
    global.requestAnimationFrame || ((cb) => setTimeout(cb, 0));

  global.cancelAnimationFrame = window.cancelAnimationFrame =
    global.cancelAnimationFrame || ((id) => clearTimeout(id));
  global.TextDecoder = util.TextDecoder as typeof TextDecoder;
  // polyfill URLSearchParams in jsdom
  window.URLSearchParams = UrlSearchParams;
}

// Disallow console.error and console.warn in tests. This should only be called
// from libraries anyway, since for user-code we should be using `Logger`, which
// automatically gets silenced on tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
console.error = function (message: any) {
  throw new Error(`console.error in test: ${message}`);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
console.warn = function (message: any) {
  // We'll have to update these methods, but for now we just ignore their
  // warning messages.
  if (message.includes("https://fb.me/react-unsafe-component-lifecycles")) {
    return;
  }

  throw new Error(`console.warn in test: ${message}`);
};

// you can import fakes from fake-indexeddb and attach them to the jsdom global
// https://github.com/dumbmatter/fakeIndexedDB#use
global.indexedDB = require("fake-indexeddb");
global.IDBIndex = require("fake-indexeddb/lib/FDBIndex");
global.IDBCursor = require("fake-indexeddb/lib/FDBCursor");
global.IDBObjectStore = require("fake-indexeddb/lib/FDBObjectStore");
global.IDBTransaction = require("fake-indexeddb/lib/FDBTransaction");
global.IDBDatabase = require("fake-indexeddb/lib/FDBDatabase");
global.IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");

// monkey-patch global websocket
global.WebSocket = global.WebSocket || ws;

global.TextEncoder = util.TextEncoder;

// React available everywhere (matches webpack config)
global.React = require("react");

// Set logEvent up with a default implementation
resetLogEventForTests();
