// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { DropZoneType } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";

import { determineActiveDropZone, shouldHandleDragEvent, prepareDragEvent } from "./dropZone";

export type HandleDragOverProps = {
  allowedExtensions?: string[];
  dragLeaveTimeoutRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
  event: DragEvent;
  hovering: DropZoneType | undefined;
  isRemote: boolean;
  setActiveZone: (zone: DropZoneType | undefined) => void;
  setHovering: (zone: DropZoneType | undefined) => void;
};

export default function handleDragOver({
  allowedExtensions,
  dragLeaveTimeoutRef,
  event,
  hovering,
  isRemote,
  setActiveZone,
  setHovering,
}: HandleDragOverProps): void {
  if (!allowedExtensions) {
    return;
  }

  const { dataTransfer } = event;
  if (!shouldHandleDragEvent(dataTransfer ?? undefined)) {
    return;
  }

  prepareDragEvent(event, dataTransfer!);

  // Clear timeout if still pending
  if (dragLeaveTimeoutRef.current) {
    clearTimeout(dragLeaveTimeoutRef.current);
    dragLeaveTimeoutRef.current = undefined;
  }

  if (!hovering) {
    setHovering("local");
  }

  const newActiveZone = determineActiveDropZone(
    { clientX: event.clientX, clientY: event.clientY },
    { width: window.innerWidth, height: window.innerHeight },
    { isRemote, topSectionRatio: 0.5 },
  );

  setActiveZone(newActiveZone);
}
