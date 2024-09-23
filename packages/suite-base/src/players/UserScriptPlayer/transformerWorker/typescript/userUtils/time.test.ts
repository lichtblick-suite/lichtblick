import { Time } from "@lichtblick/rostime";

import { subtractTimes, compare, areSame } from "./time";

describe("time", () => {
  describe("areSame", () => {
    it("should return true for times with the same sec and nsec", () => {
      const t1: Time = { sec: 10, nsec: 20 };
      const t2: Time = { sec: 10, nsec: 20 };
      expect(areSame(t1, t2)).toBe(true);
    });

    it("should return false for times with different sec", () => {
      const t1: Time = { sec: 10, nsec: 20 };
      const t2: Time = { sec: 11, nsec: 20 };
      expect(areSame(t1, t2)).toBe(false);
    });

    it("should return false for times with different nsec", () => {
      const t1: Time = { sec: 10, nsec: 20 };
      const t2: Time = { sec: 10, nsec: 21 };
      expect(areSame(t1, t2)).toBe(false);
    });

    it("should return false for times with different sec and nsec", () => {
      const t1: Time = { sec: 10, nsec: 20 };
      const t2: Time = { sec: 11, nsec: 21 };
      expect(areSame(t1, t2)).toBe(false);
    });
  });

  it("subtractTimes", () => {
    expect(subtractTimes({ sec: 1, nsec: 1 }, { sec: 1, nsec: 1 })).toEqual({ sec: 0, nsec: 0 });
    expect(subtractTimes({ sec: 1, nsec: 2 }, { sec: 2, nsec: 1 })).toEqual({ sec: -1, nsec: 1 });
    expect(subtractTimes({ sec: 5, nsec: 100 }, { sec: 2, nsec: 10 })).toEqual({
      sec: 3,
      nsec: 90,
    });
    expect(subtractTimes({ sec: 1, nsec: 1e8 }, { sec: 0, nsec: 5e8 })).toEqual({
      sec: 0,
      nsec: 600000000,
    });
    expect(subtractTimes({ sec: 1, nsec: 0 }, { sec: 0, nsec: 1e9 - 1 })).toEqual({
      sec: 0,
      nsec: 1,
    });
    expect(subtractTimes({ sec: 0, nsec: 0 }, { sec: 0, nsec: 1 })).toEqual({
      sec: -1,
      nsec: 1e9 - 1,
    });
  });
  it("compare", () => {
    expect(compare({ sec: 2, nsec: 1 }, { sec: 1, nsec: 1 })).toEqual(1);
    expect(compare({ sec: 1, nsec: 1 }, { sec: 2, nsec: 1 })).toEqual(-1);
    expect(compare({ sec: 1, nsec: 1 }, { sec: 1, nsec: 1 })).toEqual(0);
  });
});
