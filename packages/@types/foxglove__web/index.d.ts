// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

interface WindowOrWorkerGlobalScope {
  structuredClone<T>(value: T, options?: StructuredSerializeOptions): T;
}

declare function structuredClone<T>(value: T, options?: StructuredSerializeOptions): T;

type MemoryInfo = {
  /// Maximum heap size in bytes
  jsHeapSizeLimit: number;
  /// current size in bytes of the JS heap including free space not occupied by any JS objects
  totalJSHeapSize: number;
  /// total amount of memory in bytes being used by JS objects including V8 internal objects
  usedJSHeapSize: number;
};

/** https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory */
type UserAgentSpecificMemory = {
  bytes: number;
};

// Our DOM types don't have types for performance.memory since this is a chrome feature
// We make our own version of Performance which optionally has MemoryInfo
interface Performance {
  memory?: MemoryInfo;
  measureUserAgentSpecificMemory?(): Promise<UserAgentSpecificMemory>;
}
