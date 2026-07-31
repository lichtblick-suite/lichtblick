// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { HydratedSourcePool, SourceHydrator } from "./HydratedSourcePool";

// Build a hydrator whose open() yields a distinct value and whose open/close are jest spies so
// tests can assert on hydration and eviction.
function makeHydrator(value: unknown): SourceHydrator<unknown> & {
  open: jest.Mock;
  close: jest.Mock;
} {
  return {
    open: jest.fn().mockResolvedValue(value),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

describe("HydratedSourcePool", () => {
  it("reuses an admitted value without calling open again", async () => {
    // GIVEN: a pool seeded with an already-hydrated value.
    const pool = new HydratedSourcePool(4);
    const token = {};
    const hydrator = makeHydrator("seed-value");
    await pool.admit(token, hydrator, "seed-value");

    // WHEN: acquiring the same token.
    const value = await pool.acquire(token, hydrator);

    // THEN: the seeded value is returned and open() is never called.
    expect(value).toBe("seed-value");
    expect(hydrator.open).not.toHaveBeenCalled();

    pool.release(token);
  });

  it("hydrates via open() when not resident and allows eviction after release", async () => {
    // GIVEN: an empty pool and a token that has not been hydrated.
    const pool = new HydratedSourcePool(1);
    const tokenA = {};
    const hydratorA = makeHydrator("A");

    // WHEN: acquiring the token.
    const value = await pool.acquire(tokenA, hydratorA);

    // THEN: open() is invoked and its value is returned; the entry stays pinned.
    expect(value).toBe("A");
    expect(hydratorA.open).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(1);

    // WHEN: releasing and acquiring a second token that pushes over capacity.
    pool.release(tokenA);
    const tokenB = {};
    const hydratorB = makeHydrator("B");
    await pool.acquire(tokenB, hydratorB);

    // THEN: the now-unpinned first entry is evicted (closed).
    expect(hydratorA.close).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(1);

    pool.release(tokenB);
  });

  it("enforces capacity by closing the least-recently-used unpinned entry", async () => {
    // GIVEN: a pool with capacity 2.
    const pool = new HydratedSourcePool(2);
    const tokenA = {};
    const tokenB = {};
    const tokenC = {};
    const hydratorA = makeHydrator("A");
    const hydratorB = makeHydrator("B");
    const hydratorC = makeHydrator("C");

    // WHEN: admitting/acquiring three distinct unpinned tokens.
    await pool.admit(tokenA, hydratorA, "A");
    await pool.admit(tokenB, hydratorB, "B");
    await pool.acquire(tokenC, hydratorC);
    pool.release(tokenC);

    // THEN: the least-recently-used token (A) is evicted and size stays within capacity.
    expect(hydratorA.close).toHaveBeenCalledTimes(1);
    expect(hydratorB.close).not.toHaveBeenCalled();
    expect(hydratorC.close).not.toHaveBeenCalled();
    expect(pool.size).toBeLessThanOrEqual(2);
  });

  it("never evicts a pinned entry even when over capacity", async () => {
    // GIVEN: a pool with capacity 2.
    const pool = new HydratedSourcePool(2);
    const tokenA = {};
    const tokenB = {};
    const tokenC = {};
    const hydratorA = makeHydrator("A");
    const hydratorB = makeHydrator("B");
    const hydratorC = makeHydrator("C");

    // WHEN: acquiring three tokens without releasing any of them.
    await pool.acquire(tokenA, hydratorA);
    await pool.acquire(tokenB, hydratorB);
    await pool.acquire(tokenC, hydratorC);

    // THEN: all three stay resident (pool exceeds capacity) and none are closed.
    expect(pool.size).toBe(3);
    expect(hydratorA.close).not.toHaveBeenCalled();
    expect(hydratorB.close).not.toHaveBeenCalled();
    expect(hydratorC.close).not.toHaveBeenCalled();

    // WHEN: releasing the least-recently-used token (A), a subsequent acquire triggers eviction.
    pool.release(tokenA);
    const tokenD = {};
    const hydratorD = makeHydrator("D");
    await pool.acquire(tokenD, hydratorD);

    // THEN: the now-unpinned LRU entry (A) is evicted.
    expect(hydratorA.close).toHaveBeenCalledTimes(1);
    expect(hydratorB.close).not.toHaveBeenCalled();
    expect(hydratorC.close).not.toHaveBeenCalled();

    pool.release(tokenB);
    pool.release(tokenC);
    pool.release(tokenD);
  });

  it("re-hydrates via open() again after a token was evicted", async () => {
    // GIVEN: a capacity-1 pool where an acquired token is evicted by a second acquire.
    const pool = new HydratedSourcePool(1);
    const tokenA = {};
    const hydratorA = makeHydrator("A");

    await pool.acquire(tokenA, hydratorA);
    pool.release(tokenA);

    const tokenB = {};
    const hydratorB = makeHydrator("B");
    await pool.acquire(tokenB, hydratorB);
    pool.release(tokenB);

    // THEN: token A was evicted.
    expect(hydratorA.close).toHaveBeenCalledTimes(1);

    // WHEN: acquiring the evicted token again.
    const value = await pool.acquire(tokenA, hydratorA);

    // THEN: open() runs a second time to re-hydrate.
    expect(value).toBe("A");
    expect(hydratorA.open).toHaveBeenCalledTimes(2);

    pool.release(tokenA);
  });

  it("terminate() closes all resident entries and empties the pool", async () => {
    // GIVEN: a pool with two resident entries.
    const pool = new HydratedSourcePool(4);
    const tokenA = {};
    const tokenB = {};
    const hydratorA = makeHydrator("A");
    const hydratorB = makeHydrator("B");
    await pool.admit(tokenA, hydratorA, "A");
    await pool.acquire(tokenB, hydratorB);
    pool.release(tokenB);

    // WHEN: terminating the pool.
    await pool.terminate();

    // THEN: every entry is closed and the pool is empty.
    expect(hydratorA.close).toHaveBeenCalledTimes(1);
    expect(hydratorB.close).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(0);
  });

  it("removes a broken entry on rejected open() and allows a later retry", async () => {
    // GIVEN: a hydrator whose first open() rejects, then succeeds.
    const pool = new HydratedSourcePool(2);
    const token = {};
    const hydrator = {
      open: jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("recovered"),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // WHEN/THEN: the first acquire rejects and the broken entry is removed.
    await expect(pool.acquire(token, hydrator)).rejects.toThrow("boom");
    expect(pool.size).toBe(0);

    // WHEN: acquiring again after the failure.
    const value = await pool.acquire(token, hydrator);

    // THEN: open() runs a second time and the value is returned.
    expect(value).toBe("recovered");
    expect(hydrator.open).toHaveBeenCalledTimes(2);

    pool.release(token);
  });
});
