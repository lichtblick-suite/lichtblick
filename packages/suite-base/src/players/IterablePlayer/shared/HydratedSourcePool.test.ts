// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { HydratedSourcePool, SourceHydrator } from "./HydratedSourcePool";

// Build a hydrator whose open() yields a distinct value and whose open/close are jest spies so
// tests can assert on hydration and eviction.
function makeHydrator(
  value: unknown,
  weight?: number,
): SourceHydrator<unknown> & {
  open: jest.Mock;
  close: jest.Mock;
  weigh?: jest.Mock;
} {
  const hydrator: SourceHydrator<unknown> & {
    open: jest.Mock;
    close: jest.Mock;
    weigh?: jest.Mock;
  } = {
    open: jest.fn().mockResolvedValue(value),
    close: jest.fn().mockResolvedValue(undefined),
  };

  if (weight != undefined) {
    hydrator.weigh = jest.fn().mockReturnValue(weight);
  }

  return hydrator;
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

  describe("weighted budget", () => {
    it("evicts by byte budget while keeping heavy entries count low", async () => {
      // GIVEN: a pool with a 100-byte budget and entries weighing 60 bytes each.
      const pool = new HydratedSourcePool({ maxBytes: 100 });
      const tokenA = {};
      const tokenB = {};
      const hydratorA = makeHydrator("A", 60);
      const hydratorB = makeHydrator("B", 60);

      await pool.acquire(tokenA, hydratorA);
      pool.release(tokenA);

      // WHEN: a second entry pushes total resident bytes over budget.
      await pool.acquire(tokenB, hydratorB);
      pool.release(tokenB);

      // THEN: the least-recently-used heavy entry is evicted.
      expect(hydratorA.close).toHaveBeenCalledTimes(1);
      expect(hydratorB.close).not.toHaveBeenCalled();
      expect(pool.size).toBe(1);
    });

    it("keeps more small entries than a flat count would (weight below budget)", async () => {
      // GIVEN: a pool with enough byte and count budget for five small entries.
      const pool = new HydratedSourcePool({ maxBytes: 1000, maxCount: 100 });
      const tokens = [{}, {}, {}, {}, {}];
      const hydrators = tokens.map((_, index) => makeHydrator(`value-${index}`, 10));

      // WHEN: five small entries are hydrated and released.
      for (const [index, token] of tokens.entries()) {
        await pool.acquire(token, hydrators[index]!);
        pool.release(token);
      }

      // THEN: all entries remain resident and none are closed.
      expect(pool.size).toBe(5);
      for (const hydrator of hydrators) {
        expect(hydrator.close).not.toHaveBeenCalled();
      }
    });

    it("never evicts below minResident", async () => {
      // GIVEN: a pool whose byte budget is lower than two resident entries.
      const pool = new HydratedSourcePool({ maxBytes: 1, minResident: 2 });
      const tokenA = {};
      const tokenB = {};
      const hydratorA = makeHydrator("A", 10);
      const hydratorB = makeHydrator("B", 10);

      // WHEN: two overweight entries are hydrated and released.
      await pool.acquire(tokenA, hydratorA);
      pool.release(tokenA);
      await pool.acquire(tokenB, hydratorB);
      pool.release(tokenB);

      // THEN: the minResident floor keeps both entries resident.
      expect(pool.size).toBe(2);
      expect(hydratorA.close).not.toHaveBeenCalled();
      expect(hydratorB.close).not.toHaveBeenCalled();
    });

    it("keeps a single entry heavier than the whole budget", async () => {
      // GIVEN: a pool with a byte budget smaller than one entry.
      const pool = new HydratedSourcePool({ maxBytes: 5 });
      const token = {};
      const hydrator = makeHydrator("heavy", 100);

      // WHEN: an entry heavier than the whole budget is hydrated and released.
      await pool.acquire(token, hydrator);
      pool.release(token);

      // THEN: the default minResident floor keeps it resident.
      expect(pool.size).toBe(1);
      expect(hydrator.close).not.toHaveBeenCalled();
    });
  });

  it("concurrent acquire of a failing open does not leak a pin", async () => {
    // GIVEN: a pool and a hydrator whose shared open rejects for concurrent acquires.
    const pool = new HydratedSourcePool({ maxBytes: 1000, maxCount: 2 });
    const failingToken = {};
    const failingHydrator: SourceHydrator<unknown> & {
      open: jest.Mock;
      close: jest.Mock;
    } = {
      open: jest.fn().mockRejectedValue(new Error("boom")),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // WHEN: the same token is acquired twice concurrently.
    const firstAcquire = pool.acquire(failingToken, failingHydrator);
    const secondAcquire = pool.acquire(failingToken, failingHydrator);
    const results = await Promise.allSettled([firstAcquire, secondAcquire]);

    // THEN: both acquires reject and the failed entry is removed.
    for (const result of results) {
      expect(result.status).toBe("rejected");
    }
    expect(pool.size).toBe(0);

    // WHEN: a different token is acquired after the failure.
    const goodToken = {};
    const goodHydrator = makeHydrator("good", 10);
    const value = await pool.acquire(goodToken, goodHydrator);

    // THEN: the later acquire succeeds without any phantom pin or budget leak.
    expect(value).toBe("good");
    expect(pool.size).toBe(1);

    pool.release(goodToken);
  });
});
