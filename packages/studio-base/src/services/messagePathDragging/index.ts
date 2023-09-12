// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import {
  ConnectDragPreview,
  ConnectDragSource,
  ConnectDropTarget,
  DragSourceMonitor,
  useDrag,
  useDrop,
} from "react-dnd";

import Logger from "@foxglove/log";
import { DraggedMessagePath, MessagePathDropConfig, MessagePathDropStatus } from "@foxglove/studio";
import { MessagePathSelectionContextInternal } from "@foxglove/studio-base/services/messagePathDragging/MessagePathSelectionProvider";

import { MessagePathDragParams } from "./types";

const log = Logger.getLogger(__filename);

const MESSAGE_PATH_DRAG_TYPE = Symbol("MESSAGE_PATH_DRAG_TYPE");

/**
 * Internal type used for message path drag & drop support (this can differ from the type exposed to the panel API).
 */
type MessagePathDragObject = {
  items: DraggedMessagePath[];

  /**
   * Expose the drop info to the drag source so it can change cursor & appearance as necessary.
   * Undefined indicates the drag is not over a target.
   *
   * See also:
   * - https://github.com/react-dnd/react-dnd/issues/448
   * - https://github.com/react-dnd/react-dnd/issues/3529
   */
  setDropStatus: (dropStatus: MessagePathDropStatus | undefined) => void;

  /**
   * The eligible drop targets that are currently being dragged over. Used to determine when the
   * drag has left the last target.
   */
  overDropTargets: Set<string | symbol>;
};

/**
 * Use this to create a drag source for message paths that can be dropped onto target components
 * that use `useMessagePathDrop()`.
 */
export function useMessagePathDrag({ item, selected }: MessagePathDragParams): {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview;
  cursor?: CSSProperties["cursor"];
  isDragging: boolean;
  draggedItemCount: number;
} {
  const [dropStatus, setDropStatus] = useState<MessagePathDropStatus | undefined>();

  // Add this item to the list of selected items when it is selected
  const context = useContext(MessagePathSelectionContextInternal);

  const overDropTargets = useRef(new Set<string | symbol>());
  const [
    { isDragging, draggedItemCount: actualDraggedItemCount },
    connectDragSource,
    connectDragPreview,
  ] = useDrag({
    type: MESSAGE_PATH_DRAG_TYPE,
    item(_monitor: DragSourceMonitor<MessagePathDragObject>): MessagePathDragObject {
      const selectedItems = context?.getSelectedItems();
      const items = selected && selectedItems && selectedItems.length > 0 ? selectedItems : [item];
      log.debug("Starting message path drag:", items);
      return {
        // If this item is being dragged but wasn't selected, drag only this item and not the other selected items
        items,
        setDropStatus,
        overDropTargets: overDropTargets.current,
      };
    },
    options: {
      // Avoid the browser automatically using the "copy" cursor; we manage the cursor ourselves below
      dropEffect: "move",
    },
    previewOptions: {
      // Allow the draggedItemCount badge to be shown as part of the drag preview
      captureDraggingState: true,
    },
    collect(monitor) {
      return {
        isDragging: monitor.isDragging(),
        draggedItemCount: monitor.isDragging() ? monitor.getItem().items.length : 0,
      };
    },
  });

  let cursor = undefined;
  if (isDragging) {
    if (!dropStatus) {
      cursor = "auto";
    } else if (!dropStatus.canDrop) {
      cursor = "no-drop";
    } else if (dropStatus.effect === "add") {
      cursor = "copy";
    } else {
      cursor = "auto";
    }
  }

  // To allow the draggedItemCount to be shown in the drag preview, we have to breifly render with
  // the actual count, then re-render with the count at 0 to avoid showing the item count in the
  // page itself.
  const [displayedDraggedItemCount, setDisplayedDraggedItemCount] = useState(0);
  useLayoutEffect(() => {
    if (!isDragging) {
      return undefined;
    }
    setDisplayedDraggedItemCount(actualDraggedItemCount);
    const timeout = setTimeout(() => {
      setDisplayedDraggedItemCount(0);
    }, 0);
    return () => {
      clearTimeout(timeout);
    };
  }, [actualDraggedItemCount, isDragging]);

  const connectDragPreviewWithCaptureDraggingState: ConnectDragPreview = useCallback(
    (el) => connectDragPreview(el, { captureDraggingState: true }),
    [connectDragPreview],
  );

  return {
    connectDragSource,
    connectDragPreview: connectDragPreviewWithCaptureDraggingState,
    cursor,
    isDragging,
    draggedItemCount: displayedDraggedItemCount,
  };
}

/**
 * Use this to create a drop target accepting message paths dragged from components that use
 * `useMessagePathDrag()`.
 */
export function useMessagePathDrop(): {
  /** True if the target supports dragging (a config is set) and a drag has started */
  isDragging: boolean;
  isOver: boolean;
  isValidTarget: boolean;
  dropMessage: string | undefined;
  connectMessagePathDropTarget: ConnectDropTarget;
  setMessagePathDropConfig: (config: MessagePathDropConfig | undefined) => void;
} {
  const [messagePathDropConfig, setMessagePathDropConfig] = useState<
    MessagePathDropConfig | undefined
  >();

  const [{ isDragging, isOver, isValidTarget, message }, connectDropTarget] = useDrop({
    accept: MESSAGE_PATH_DRAG_TYPE,
    canDrop(dragObject: MessagePathDragObject, _monitor) {
      if (!messagePathDropConfig) {
        return false;
      }
      if (messagePathDropConfig.getDropStatus(dragObject.items).canDrop) {
        return true;
      }
      return false;
    },
    collect(monitor) {
      // don't run the code below when dragging other types of items (i.e. panels)
      if (monitor.getItemType() !== MESSAGE_PATH_DRAG_TYPE) {
        return { isDragging: false, isOver: false, isValidTarget: false };
      }
      const dragObject = monitor.getItem<MessagePathDragObject | undefined>();
      const firstItem = dragObject?.items[0];
      const targetId = monitor.getHandlerId();
      if (!dragObject || !firstItem || targetId == undefined) {
        return {
          isDragging: dragObject != undefined && firstItem != undefined,
          isOver: false,
          isValidTarget: false,
        };
      }
      const monitorIsOver = monitor.isOver({ shallow: true });
      const dropStatus = messagePathDropConfig?.getDropStatus(dragObject.items) ?? {
        canDrop: false,
      };

      // Not ideal to have side effects in collect(), but this is the only place where we get
      // access to "isOver: false" when the drag leaves the target.
      if (monitorIsOver) {
        dragObject.overDropTargets.add(targetId);
        dragObject.setDropStatus(dropStatus);
      } else {
        dragObject.overDropTargets.delete(targetId);
        if (dragObject.overDropTargets.size === 0) {
          dragObject.setDropStatus(undefined);
        }
      }

      return {
        isDragging: true,
        isOver: monitorIsOver && monitor.canDrop(),
        isValidTarget: dropStatus.canDrop,
        message:
          dropStatus.message ??
          `${dropStatus.effect === "add" ? "Add" : "View"} ${firstItem.path}` +
            (dragObject.items.length > 1 ? ` and ${dragObject.items.length - 1} more` : ""),
      };
    },
    drop(dragObject, _monitor) {
      messagePathDropConfig?.handleDrop(dragObject.items);
    },
  });

  return {
    isDragging,
    isOver,
    isValidTarget,
    dropMessage: message,
    connectMessagePathDropTarget: connectDropTarget,
    setMessagePathDropConfig,
  };
}
