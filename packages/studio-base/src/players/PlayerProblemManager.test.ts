// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";

describe("PlayerProblemManager", () => {
  it("keys problems by id", () => {
    const manager = new PlayerProblemManager();
    expect(manager.problems()).toEqual([]);
    manager.addProblem("a", { severity: "error", message: "A" });
    expect(manager.problems()).toEqual([{ severity: "error", message: "A" }]);
    manager.addProblem("b", { severity: "error", message: "B" });
    manager.addProblem("a", { severity: "warn", message: "A2" });
    expect(manager.problems()).toEqual([
      { severity: "warn", message: "A2" },
      { severity: "error", message: "B" },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(2);
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  it("allows removing problems by id", () => {
    const manager = new PlayerProblemManager();
    manager.addProblem("a", { severity: "warn", message: "A" });
    manager.addProblem("b", { severity: "warn", message: "B" });
    manager.addProblem("c", { severity: "error", message: "C" });
    expect(manager.removeProblem("b")).toBe(true);
    expect(manager.problems()).toEqual([
      { severity: "warn", message: "A" },
      { severity: "error", message: "C" },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  it("allows removing problems with a predicate", () => {
    const manager = new PlayerProblemManager();
    manager.addProblem("a", { severity: "warn", message: "A" });
    manager.addProblem("b", { severity: "warn", message: "B" });
    manager.addProblem("c", { severity: "error", message: "C" });
    manager.addProblem("d", { severity: "error", message: "D" });
    expect(manager.removeProblems((id, problem) => id === "c" || problem.severity === "warn")).toBe(
      true,
    );
    expect(manager.problems()).toEqual([{ severity: "error", message: "D" }]);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(2);
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  it("keeps array identity until problems change", () => {
    const manager = new PlayerProblemManager();

    let result = manager.problems();
    expect(result).toEqual([]);
    expect(manager.problems()).toBe(result);

    manager.addProblem("a", { severity: "error", message: "A" });
    manager.addProblem("b", { severity: "error", message: "B" });
    result = manager.problems();
    expect(result).toEqual([
      { severity: "error", message: "A" },
      { severity: "error", message: "B" },
    ]);
    expect(manager.problems()).toBe(result);

    // key is not present - no change
    expect(manager.removeProblem("c")).toBe(false);
    expect(manager.problems()).toBe(result);

    // predicate does not match any problems - no change
    expect(manager.removeProblems(() => false)).toBe(false);
    expect(manager.problems()).toBe(result);

    // remove by id
    expect(manager.removeProblem("a")).toBe(true);
    result = manager.problems();
    expect(result).toEqual([{ severity: "error", message: "B" }]);
    expect(manager.problems()).toBe(result);

    // remove by predicate
    expect(manager.removeProblems((id) => id === "b")).toBe(true);
    result = manager.problems();
    expect(result).toEqual([]);
    expect(manager.problems()).toBe(result);
    expect(console.error).toHaveBeenCalledTimes(2);
    (console.error as jest.Mock).mockClear();
  });
});
