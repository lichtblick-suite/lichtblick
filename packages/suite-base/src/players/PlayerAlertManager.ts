// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlayerAlert } from "@lichtblick/suite-base/players/types";

/**
 * Manages a set of PlayerAlerts keyed by ID. Calls to alerts() will return the same object as
 * long as alerts have not been added/removed; this helps the player pipeline to know when it
 * needs to re-process alert alerts.
 */
export default class PlayerAlertManager {
  #alertsById = new Map<string, PlayerAlert>();
  #alerts?: PlayerAlert[];

  /**
   * Returns the current set of alerts. Subsequent calls will return the same object as long as
   * alerts have not been added/removed.
   */
  public alerts(): PlayerAlert[] {
    return (this.#alerts ??= Array.from(this.#alertsById.values()));
  }

  public addAlert(id: string, alert: PlayerAlert): void {
    console[alert.severity].call(console, "Player alert", id, alert);
    this.#alertsById.set(id, alert);
    this.#alerts = undefined;
  }

  public hasAlert(id: string): boolean {
    return this.#alertsById.has(id);
  }

  public removeAlert(id: string): boolean {
    const changed = this.#alertsById.delete(id);
    if (changed) {
      this.#alerts = undefined;
    }
    return changed;
  }

  public removeAlerts(predicate: (id: string, alert: PlayerAlert) => boolean): boolean {
    let changed = false;
    for (const [id, alert] of this.#alertsById) {
      if (predicate(id, alert)) {
        if (this.#alertsById.delete(id)) {
          changed = true;
        }
      }
    }
    if (changed) {
      this.#alerts = undefined;
    }
    return changed;
  }

  public clear(): void {
    this.#alertsById.clear();
    this.#alerts = undefined;
  }
}
