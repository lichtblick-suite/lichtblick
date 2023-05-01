// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlayerProblem } from "@foxglove/studio-base/players/types";

/**
 * Manages a set of PlayerProblems keyed by ID. Calls to problems() will return the same object as
 * long as problems have not been added/removed; this helps the player pipeline to know when it
 * needs to re-process player problems.
 */
export default class PlayerProblemManager {
  #problemsById = new Map<string, PlayerProblem>();
  #problems?: PlayerProblem[];

  /**
   * Returns the current set of problems. Subsequent calls will return the same object as long as
   * problems have not been added/removed.
   */
  public problems(): PlayerProblem[] {
    return (this.#problems ??= Array.from(this.#problemsById.values()));
  }

  public addProblem(id: string, problem: PlayerProblem): void {
    console[problem.severity].call(console, "Player problem", id, problem);
    this.#problemsById.set(id, problem);
    this.#problems = undefined;
  }

  public hasProblem(id: string): boolean {
    return this.#problemsById.has(id);
  }

  public removeProblem(id: string): boolean {
    const changed = this.#problemsById.delete(id);
    if (changed) {
      this.#problems = undefined;
    }
    return changed;
  }

  public removeProblems(predicate: (id: string, problem: PlayerProblem) => boolean): boolean {
    let changed = false;
    for (const [id, problem] of this.#problemsById) {
      if (predicate(id, problem)) {
        if (this.#problemsById.delete(id)) {
          changed = true;
        }
      }
    }
    if (changed) {
      this.#problems = undefined;
    }
    return changed;
  }

  public clear(): void {
    this.#problemsById.clear();
    this.#problems = undefined;
  }
}
