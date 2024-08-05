// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  BOTH_TOPICS_DO_NOT_EXIST_HUD_ITEM_ID,
  IMAGE_TOPIC_DOES_NOT_EXIST_HUD_ITEM_ID,
  CALIBRATION_TOPIC_DOES_NOT_EXIST_HUD_ITEM_ID,
  WAITING_FOR_BOTH_MESSAGES_HUD_ID,
  WAITING_FOR_IMAGES_EMPTY_HUD_ID,
  WAITING_FOR_CALIBRATION_HUD_ID,
  WAITING_FOR_SYNC_EMPTY_HUD_ID,
} from "./renderables/ImageMode/constants";

export type HUDItem = {
  /** Unique identifier for the item. Adding a message with the same id twice will result in a no-op */
  id: string;
  /** Designate what group this belongs to. Allows items to be cleared by group.
   * Would allow scene extensions to only clear their own items when applicable.
   */
  group: string;
  /** Function to return message content to show on HUD */
  getMessage: () => string;
  /** Display type */
  displayType: "empty" | "notice";
};

/** Priority list of HUD item ids. IDs earlier in the list should be shown before items later in the list.
 * This list is reversed before use to take advantage of `indexOf` for items that aren't included being lower priority than items on the list.
 * IDs not in this list will be shown after all items in this list.
 */
export const HUD_ID_PRIORITIES = [
  BOTH_TOPICS_DO_NOT_EXIST_HUD_ITEM_ID,
  IMAGE_TOPIC_DOES_NOT_EXIST_HUD_ITEM_ID,
  CALIBRATION_TOPIC_DOES_NOT_EXIST_HUD_ITEM_ID,
  WAITING_FOR_BOTH_MESSAGES_HUD_ID,
  WAITING_FOR_IMAGES_EMPTY_HUD_ID,
  WAITING_FOR_CALIBRATION_HUD_ID,
  WAITING_FOR_SYNC_EMPTY_HUD_ID,
].reverse();

export class HUDItemManager {
  #HUDItemsById = new Map<string, HUDItem>();
  #onChange: () => void;
  public constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  public addHUDItem(item: HUDItem): void {
    if (!this.#HUDItemsById.has(item.id)) {
      this.#HUDItemsById.set(item.id, item);
      this.#onChange();
    }
  }

  public removeHUDItem(id: string): void {
    if (this.#HUDItemsById.delete(id)) {
      this.#onChange();
    }
  }

  public removeGroup(group: string): void {
    const items = this.getHUDItems();
    for (const item of items) {
      if (item.group === group) {
        this.removeHUDItem(item.id);
      }
    }
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public displayIfTrue(value: boolean, hudItem: HUDItem): void {
    if (value) {
      this.addHUDItem(hudItem);
    } else {
      this.removeHUDItem(hudItem.id);
    }
  }

  /** Returns list of HUD items in ascending priority order.
   * High priority items will be last in the list.
   */
  public getHUDItems(): HUDItem[] {
    // sort by priority on return
    // high priority items should be at the end of the list
    return Array.from(this.#HUDItemsById.values()).sort((a, b) => {
      const aPriority = HUD_ID_PRIORITIES.indexOf(a.id);
      const bPriority = HUD_ID_PRIORITIES.indexOf(b.id);
      return aPriority - bPriority;
    });
  }

  public clear(): void {
    this.#HUDItemsById.clear();
    this.#onChange();
  }
}
