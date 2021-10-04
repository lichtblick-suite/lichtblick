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
import { v4 as uuidv4 } from "uuid";

import { Time, add, areEqual, isGreaterThan } from "@foxglove/rostime";
import { Interactive } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { BaseMarker } from "@foxglove/studio-base/types/Messages";

const ZERO_TIME = { sec: 0, nsec: 0 };

// Not a concrete type, just descriptive.
type ObjectWithInteractionData = Interactive<unknown>;

class MessageWithLifetime {
  message: ObjectWithInteractionData;
  receiveTime: Time;
  // If lifetime is present and non-zero, the marker expires when the collector clock is greater
  // than receiveTime + lifetime.
  // If lifetime is zero, the marker remains until deleted by name.
  // If absent, the marker is removed from the collector using explicit "flush" actions.
  lifetime?: Time;

  constructor(message: ObjectWithInteractionData, receiveTime: Time, lifetime: Time | undefined) {
    this.message = message;
    this.receiveTime = receiveTime;
    this.lifetime = lifetime;
  }

  // support in place update w/ mutation to avoid allocating
  // a MarkerWithLifetime wrapper for every marker on every tick
  // only allocate on new markers
  update(message: ObjectWithInteractionData, receiveTime: Time, lifetime?: Time) {
    this.message = message;
    this.receiveTime = receiveTime;
    this.lifetime = lifetime;
  }

  isExpired(currentTime: Time) {
    if (this.lifetime == undefined) {
      // Do not expire markers if we can't tell what their lifetime is.
      // They'll be flushed later if needed (see flush below)
      return false;
    }
    const lifetime: Time = this.lifetime;

    if (areEqual(lifetime, ZERO_TIME)) {
      // Do not expire markers with infinite lifetime (lifetime == 0)
      return false;
    }

    // we use the receive time (clock) instead of the header stamp
    // to match the behavior of rviz
    const expiresAt = add(this.receiveTime, lifetime);

    return isGreaterThan(currentTime, expiresAt);
  }
}

// used to collect marker and non-marker visualization messages
// for a given topic and ensure the lifecycle is managed properly
export default class MessageCollector {
  markers: Map<string, MessageWithLifetime> = new Map();
  clock: Time = { sec: 0, nsec: 0 };

  setClock(clock: Time): void {
    const clockMovedBackwards = isGreaterThan(this.clock, clock);

    if (clockMovedBackwards) {
      this.markers.forEach((marker, key) => {
        const markerReceivedAfterClock = isGreaterThan(marker.receiveTime, clock);
        if (markerReceivedAfterClock) {
          this.markers.delete(key);
        }
      });
      this.flush();
    }
    this.clock = clock;
  }

  flush(): void {
    // clear out all undefined lifetime markers
    this.markers.forEach((marker, key) => {
      if (marker.lifetime == undefined) {
        this.markers.delete(key);
      }
    });
  }

  private _addItem(key: string, item: ObjectWithInteractionData, lifetime?: Time): void {
    const existing = this.markers.get(key);
    if (existing) {
      existing.update(item, this.clock, lifetime);
    } else {
      this.markers.set(key, new MessageWithLifetime(item, this.clock, lifetime));
    }
  }

  addMarker(marker: Interactive<BaseMarker>, name: string): void {
    this._addItem(name, marker, marker.lifetime);
  }

  deleteMarker(name: string): void {
    this.markers.delete(name);
  }

  deleteAll(): void {
    this.markers.clear();
  }

  addNonMarker(topic: string, message: ObjectWithInteractionData, lifetime?: Time): void {
    // Non-marker data is removed in two ways:
    //  - Messages with lifetimes expire only at the end of their lifetime. Multiple messages on the
    //    same topic are added and expired independently.
    //  - Messages without lifetimes overwrite others on the same topic -- there is at most one per
    //    topic at any time. These messages are also removed when `flush` is called.
    //
    // Topics are expected to have data in one of these two "modes" at a time.
    // Non-marker messages are not expected to have names, as they have no "delete" operation.

    if (lifetime != undefined) {
      // Assuming that all future messages will have a decay time set,
      // we need to immediately expire any pre-existing message that didn't have a decay time.
      this.markers.delete(topic);

      // Create a unique key for each new message.
      const key = `${topic}/${uuidv4()}`;
      this._addItem(key, message, lifetime);
    } else {
      // if future messages will not have a decay time set,
      // we should expire any pre-existing message that have potentially longer decay times.
      for (const key of this.markers.keys()) {
        if (key.indexOf(`${topic}/`) === 0) {
          this.markers.delete(key);
        }
      }
      this._addItem(topic, message);
    }
  }

  getMessages(): ObjectWithInteractionData[] {
    const result: ObjectWithInteractionData[] = [];
    this.markers.forEach((marker, key) => {
      // Check if the marker has a lifetime and should be deleted
      if (marker.isExpired(this.clock)) {
        this.markers.delete(key);
      } else {
        result.push(marker.message);
      }
    });
    return result;
  }
}
