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

import signal from "@foxglove/studio-base/util/signal";

import debouncePromise from "./debouncePromise";

describe("debouncePromise", () => {
  it("debounces with resolved and rejected signals", async () => {
    // These signals allow us to precisely control and wait for when calls to the debounced function start/finish.
    const callsStarted = [signal(), signal(), signal(), signal()]; // indicate when the debounced function is called
    const callReturns = [signal(), signal(), signal(), signal()]; // allows test code to "release" pending calls by letting them finish
    const callsFinished = [signal(), signal(), signal(), signal()]; // indicate when the .currentPromise completes

    let numCallsStarted = 0;
    const debouncedFn = debouncePromise(() => {
      callsStarted[numCallsStarted]?.resolve();
      const promise = callReturns[numCallsStarted];
      ++numCallsStarted;
      if (!promise) {
        throw new Error("no remaining promises");
      }
      return promise;
    });

    let prevExpectedCallsStarted = 0;
    function expectCallsStarted(expectedNum: number) {
      expect(numCallsStarted).toBe(expectedNum);
      // Whenever a new call is started, attach handlers to the currentPromise.
      // We need to take care to do this only once per actual call started.
      if (expectedNum !== prevExpectedCallsStarted) {
        const finishedSignal = callsFinished[prevExpectedCallsStarted];
        debouncedFn.currentPromise?.then(
          () => finishedSignal?.resolve(),
          (err) => finishedSignal?.reject(err),
        );
      }
      prevExpectedCallsStarted = expectedNum;
    }

    // The first call is allowed to start immediately.
    debouncedFn();
    expectCallsStarted(1);

    // Subsequent calls are queued up and a single queued call starts after the first one finishes.
    // After the second finishes, no more calls should be pending.
    debouncedFn();
    debouncedFn();
    debouncedFn();
    expectCallsStarted(1);
    callReturns[0]?.resolve();
    await callsStarted[0];
    await callsStarted[1];
    expectCallsStarted(2);
    callReturns[1]?.reject(new Error("1"));
    expect(debouncedFn.currentPromise).toBeDefined();
    await callsFinished[0];
    await expect(callsFinished[1]).rejects.toThrow("1");
    expectCallsStarted(2);
    expect(debouncedFn.currentPromise).toBeUndefined();

    // Now we can immediately start a third call.
    debouncedFn();
    expectCallsStarted(3);
    await callsStarted[2];
    expect(debouncedFn.currentPromise).toBeDefined();

    // The previous call is still running, so we don't start a new call yet.
    debouncedFn();
    expectCallsStarted(3);
    callReturns[2]?.reject(new Error("2"));
    await expect(callsFinished[2]).rejects.toThrow("2");
    // After the 3rd call finishes, the 4th can begin.
    await callsStarted[3];
    expectCallsStarted(4);
    expect(debouncedFn.currentPromise).toBeDefined();
    callReturns[3]?.resolve();
    await callsFinished[3];
    expect(debouncedFn.currentPromise).toBeUndefined();
    expectCallsStarted(4);
  });

  it("provides currentPromise to wait on the current call", async () => {
    expect.assertions(5);

    const sig = signal();
    let calls = 0;
    const debouncedFn = debouncePromise(() => {
      ++calls;
      return sig;
    });

    expect(calls).toBe(0);

    debouncedFn();
    expect(calls).toBe(1);

    // the original function should not be called until the signal is resolved
    debouncedFn();
    debouncedFn();
    await Promise.resolve();
    expect(calls).toBe(1);

    // once the first promise is resolved, the second call should start
    let promise = debouncedFn.currentPromise;
    if (!promise) {
      throw new Error("currentPromise should be defined");
    }
    promise = promise.then(() => {
      expect(calls).toBe(2);
    });

    sig.resolve();

    await promise;

    // after pending calls are finished, there is no more currentPromise
    expect(debouncedFn.currentPromise).toBeUndefined();
  });

  it("handles nested calls", async () => {
    let calls = 0;
    const debouncedFn = debouncePromise(async () => {
      ++calls;
      if (calls === 1) {
        debouncedFn();
      }
    });

    debouncedFn();
    expect(calls).toBe(1);
    await Promise.resolve();
    expect(calls).toBe(2);
  });
});
