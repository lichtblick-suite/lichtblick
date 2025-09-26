// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  BOTH_TOPICS_DO_NOT_EXIST_ID,
  IMAGE_TOPIC_DOES_NOT_EXIST_ID,
  CALIBRATION_TOPIC_DOES_NOT_EXIST_ID,
  WAITING_FOR_BOTH_MESSAGES_ID,
  WAITING_FOR_IMAGES_EMPTY_ID,
  WAITING_FOR_CALIBRATION_ID,
  WAITING_FOR_SYNC_EMPTY_ID,
} from "./renderables/ImageMode/constants";

export type NotificationItem = {
  /** Unique identifier for the item. Adding a message with the same id twice will result in a no-op */
  id: string;
  /** Designate what group this belongs to. Allows items to be cleared by group.
   * Would allow scene extensions to only clear their own items when applicable.
   */
  group: string;
  /** Function to return message content to show */
  getMessage: () => string;
  /** Display type */
  displayType: "empty" | "notice";
};

/** Priority list of notification item ids. IDs earlier in the list should be shown before items later in the list.
 * This list is reversed before use to take advantage of `indexOf` for items that aren't included being lower priority than items on the list.
 * IDs not in this list will be shown after all items in this list.
 */
export const NOTIFICATION_ID_PRIORITIES = [
  WAITING_FOR_SYNC_EMPTY_ID,
  WAITING_FOR_CALIBRATION_ID,
  WAITING_FOR_IMAGES_EMPTY_ID,
  WAITING_FOR_BOTH_MESSAGES_ID,
  CALIBRATION_TOPIC_DOES_NOT_EXIST_ID,
  IMAGE_TOPIC_DOES_NOT_EXIST_ID,
  BOTH_TOPICS_DO_NOT_EXIST_ID,
];

export class NotificationManager {
  #NotificationItemsById = new Map<string, NotificationItem>();
  #onChange: () => void;
  public constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  public addNotificationItem(item: NotificationItem): void {
    if (!this.#NotificationItemsById.has(item.id)) {
      this.#NotificationItemsById.set(item.id, item);
      this.#onChange();
    }
  }

  public removeNotificationItem(id: string): void {
    if (this.#NotificationItemsById.delete(id)) {
      this.#onChange();
    }
  }

  public removeGroup(group: string): void {
    const items = this.getNotificationItems();
    for (const item of items) {
      if (item.group === group) {
        this.removeNotificationItem(item.id);
      }
    }
  }

  // eslint-disable-next-line @lichtblick/no-boolean-parameters
  public displayIfTrue(value: boolean, hudItem: NotificationItem): void {
    if (value) {
      this.addNotificationItem(hudItem);
    } else {
      this.removeNotificationItem(hudItem.id);
    }
  }

  /** Returns list of HUD items in ascending priority order.
   * High priority items will be last in the list.
   */
  public getNotificationItems(): NotificationItem[] {
    // sort by priority on return
    // high priority items should be at the end of the list
    return Array.from(this.#NotificationItemsById.values()).sort((a, b) => {
      const aPriority = NOTIFICATION_ID_PRIORITIES.indexOf(a.id);
      const bPriority = NOTIFICATION_ID_PRIORITIES.indexOf(b.id);
      return aPriority - bPriority;
    });
  }

  public clear(): void {
    this.#NotificationItemsById.clear();
    this.#onChange();
  }
}
