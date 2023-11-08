// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DraggedMessagePath } from "@foxglove/studio-base/components/PanelExtensionAdapter";

export type MessagePathDragParams = {
  /**
   * The item represented by the component that is using `useMessagePathDrag`. If no items are
   * selected and a drag begins on this component, this will be used as the drag item.
   */
  item: DraggedMessagePath;
  /**
   * Whether this item is currently selected.
   */
  selected: boolean;
};
