// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ComlinkWrap } from "@lichtblick/den/worker";

import { WorkerSerializedIterableSource } from "./WorkerSerializedIterableSource";

jest.mock("@lichtblick/den/worker", () => ({
  ComlinkWrap: jest.fn(),
}));

const mockComlinkWrap = ComlinkWrap as jest.MockedFunction<typeof ComlinkWrap>;

function makeMockRemote(overrides: { terminate?: jest.Mock } = {}) {
  return {
    initialize: jest.fn().mockResolvedValue({ topics: [] }),
    terminate: overrides.terminate ?? jest.fn().mockResolvedValue(undefined),
  };
}

function makeSource(): WorkerSerializedIterableSource {
  return new WorkerSerializedIterableSource({
    initWorker: () => ({}) as unknown as Worker,
    initArgs: {},
  });
}

describe("WorkerSerializedIterableSource", () => {
  beforeEach(() => {
    mockComlinkWrap.mockReset();
  });

  it("still disposes the worker when the remote's terminate() rejects", async () => {
    // GIVEN: an initialized source whose worker-side terminate() rejects.
    const dispose = jest.fn();
    const remote = makeMockRemote({ terminate: jest.fn().mockRejectedValue(new Error("boom")) });
    mockComlinkWrap.mockReturnValueOnce({
      remote: jest.fn().mockResolvedValue(remote) as any,
      dispose,
    });
    const source = makeSource();
    await source.initialize();

    // WHEN/THEN: terminate() rejects with the same error...
    await expect(source.terminate()).rejects.toThrow("boom");

    // ...but the worker is still disposed.
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("does not let a concurrent initialize() worker get disposed or cleared by an in-flight terminate()", async () => {
    // GIVEN: a first initialized worker whose terminate() call is left pending.
    const dispose1 = jest.fn();
    let resolveTerminate1: () => void = () => {};
    const terminate1Promise = new Promise<void>((resolve) => {
      resolveTerminate1 = resolve;
    });
    const remote1 = makeMockRemote({ terminate: jest.fn().mockReturnValue(terminate1Promise) });
    mockComlinkWrap.mockReturnValueOnce({
      remote: jest.fn().mockResolvedValue(remote1) as any,
      dispose: dispose1,
    });
    const source = makeSource();
    await source.initialize();

    // WHEN: terminate() is started but not yet resolved...
    const firstTerminate = source.terminate();

    // ...and, before it resolves, initialize() is called again, producing a second worker.
    const dispose2 = jest.fn();
    const remote2 = makeMockRemote();
    mockComlinkWrap.mockReturnValueOnce({
      remote: jest.fn().mockResolvedValue(remote2) as any,
      dispose: dispose2,
    });
    await source.initialize();

    // Let the first terminate()'s remote.terminate() resolve.
    resolveTerminate1();
    await firstTerminate;

    // THEN: only the worker captured by the first terminate() call was disposed; the second
    // (newer) worker from the concurrent initialize() was left untouched.
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).not.toHaveBeenCalled();

    // AND: the source still targets the second (newer) worker — a subsequent terminate() operates
    // on it, proving it wasn't cleared by the earlier in-flight terminate().
    await source.terminate();
    expect(remote2.terminate).toHaveBeenCalledTimes(1);
    expect(dispose2).toHaveBeenCalledTimes(1);
  });
});
