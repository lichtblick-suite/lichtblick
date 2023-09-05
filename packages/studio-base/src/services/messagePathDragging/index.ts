// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, useMemo, useRef, useState } from "react";
import {
  ConnectDragPreview,
  ConnectDragSource,
  ConnectDropTarget,
  useDrag,
  useDrop,
} from "react-dnd";

import { MessagePathDropConfig, MessagePathDropStatus } from "@foxglove/studio";

const MESSAGE_PATH_DRAG_TYPE = Symbol("MESSAGE_PATH_DRAG_TYPE");

/**
 * Internal type used for message path drag & drop support (this can differ from the type exposed to the panel API).
 */
type MessagePathDragObject = {
  path: string;
  rootSchemaName: string | undefined;
  isTopic: boolean;
  isLeaf: boolean;

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

type MessagePathDragParams = {
  path: string;
  rootSchemaName: string | undefined;
  isTopic: boolean;
  isLeaf: boolean;
};

/**
 * Use this to create a drag source for message paths that can be dropped onto target components
 * that use `useMessagePathDrop()`.
 */
export function useMessagePathDrag({
  path,
  rootSchemaName,
  isTopic,
  isLeaf,
}: MessagePathDragParams): {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview;
  cursor?: CSSProperties["cursor"];
  isDragging: boolean;
} {
  const [dropStatus, setDropStatus] = useState<MessagePathDropStatus | undefined>();
  const overDropTargets = useRef(new Set<string | symbol>());
  const dragItem = useMemo<MessagePathDragObject>(
    () => ({
      path,
      rootSchemaName,
      isTopic,
      isLeaf,
      setDropStatus,
      overDropTargets: overDropTargets.current,
    }),
    [path, rootSchemaName, isTopic, isLeaf],
  );
  const [{ isDragging }, connectDragSource, connectDragPreview] = useDrag({
    type: MESSAGE_PATH_DRAG_TYPE,
    item: dragItem,
    options: {
      // Avoid the browser automatically using the "copy" cursor; we manage the cursor ourselves below
      dropEffect: "move",
    },
    collect(monitor) {
      return {
        isDragging: monitor.isDragging(),
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

  return { connectDragSource, connectDragPreview, cursor, isDragging };
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
    canDrop(item: MessagePathDragObject, _monitor) {
      if (!messagePathDropConfig) {
        return false;
      }
      if (messagePathDropConfig.getDropStatus(item).canDrop) {
        return true;
      }
      return false;
    },
    collect(monitor) {
      // don't run the code below when dragging other types of items (i.e. panels)
      if (monitor.getItemType() !== MESSAGE_PATH_DRAG_TYPE) {
        return { isDragging: false, isOver: false, isValidTarget: false };
      }
      const item = monitor.getItem<MessagePathDragObject | undefined>();
      const targetId = monitor.getHandlerId();
      if (!item || targetId == undefined) {
        return {
          isDragging: item != undefined,
          isOver: false,
          isValidTarget: false,
        };
      }
      const monitorIsOver = monitor.isOver({ shallow: true });
      const dropStatus = messagePathDropConfig?.getDropStatus(item) ?? { canDrop: false };

      // Not ideal to have side effects in collect(), but this is the only place where we get
      // access to "isOver: false" when the drag leaves the target.
      if (monitorIsOver) {
        item.overDropTargets.add(targetId);
        item.setDropStatus(dropStatus);
      } else {
        item.overDropTargets.delete(targetId);
        if (item.overDropTargets.size === 0) {
          item.setDropStatus(undefined);
        }
      }

      return {
        isDragging: true,
        isOver: monitorIsOver && monitor.canDrop(),
        isValidTarget: dropStatus.canDrop,
        message:
          dropStatus.message ??
          (dropStatus.effect === "add" ? `Add ${item.path}` : `View ${item.path}`),
      };
    },
    drop(item, _monitor) {
      messagePathDropConfig?.handleDrop(item);
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
