// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventNames, EventListener } from "eventemitter3";

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { Layout, LayoutID, LayoutPermission } from "@foxglove/studio-base/services/ILayoutStorage";

export type LayoutManagerEventTypes = {
  /**
   * Called when a change has occurred to the layouts and the user interface should be updated.
   * If a particular layout was updated, its data will be passed in the event.
   */
  change: (event: { updatedLayout: Layout | undefined }) => void;

  /** Called when the layout manager starts or stops asynchronous activity.  */
  busychange: () => void;

  /** Called when the layout manager goes online or offline.  */
  onlinechange: () => void;
};
/**
 * The Layout Manager is a high-level interface on top of raw layout storage which maps more closely
 * to actions the user can take in the application.
 * @see LayoutManager concrete implementation
 */
export interface ILayoutManager {
  /** Indicates whether permissions other than "CREATOR_WRITE" are supported. */
  readonly supportsSharing: boolean;

  /** Indicates whether the layout manager is currently performing an async operation. */
  readonly isBusy: boolean;

  /** Indicates whether the layout manager is currently performing an async operation. */
  readonly isOnline: boolean;

  /**
   * Inform the layout manager whether it is online or offline (and remote requests may be expected to fail).
   */
  setOnline(online: boolean): void;

  on<E extends EventNames<LayoutManagerEventTypes>>(
    name: E,
    listener: EventListener<LayoutManagerEventTypes, E>,
  ): void;
  off<E extends EventNames<LayoutManagerEventTypes>>(
    name: E,
    listener: EventListener<LayoutManagerEventTypes, E>,
  ): void;

  getLayouts(): Promise<readonly Layout[]>;

  getLayout(id: LayoutID): Promise<Layout | undefined>;

  saveNewLayout(params: {
    name: string;
    data: PanelsState;
    permission: LayoutPermission;
  }): Promise<Layout>;

  /**
   * Persist changes to the user's edited copy of this layout.
   *
   * @note If the layout has not been edited before, the returned layout's id may be different from
   * the input id.
   */
  updateLayout(params: { id: LayoutID; name?: string; data?: PanelsState }): Promise<Layout>;

  deleteLayout(params: { id: LayoutID }): Promise<void>;

  /** Save the local changes so they override the baseline. */
  overwriteLayout(params: { id: LayoutID }): Promise<Layout>;

  /** Revert this layout to the baseline. */
  revertLayout(params: { id: LayoutID }): Promise<Layout>;

  /** Transfer a shared layout's working changes into a new personal layout. */
  makePersonalCopy(params: { id: LayoutID; name: string }): Promise<Layout>;
}
