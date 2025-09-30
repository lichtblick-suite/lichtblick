// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Dialog } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import {
  DATA_SOURCE_FILES,
  LAYOUT_AND_EXTENSION_FILES,
} from "@lichtblick/suite-base/components/MultiDropZoneListener/constants";
import {
  DropZoneType,
  MultiDropZoneListenerProps,
} from "@lichtblick/suite-base/components/MultiDropZoneListener/types";
import { generateDropZoneHelpMessage } from "@lichtblick/suite-base/components/MultiDropZoneListener/utils/dropZoneInfo";
import handleDragOver from "@lichtblick/suite-base/components/MultiDropZoneListener/utils/handleDragOver";
import handleDrop from "@lichtblick/suite-base/components/MultiDropZoneListener/utils/handleDrop";

import { useStyles } from "./MultiDropZoneListener.style";

export default function MultiDropZoneListener(
  props: MultiDropZoneListenerProps,
): React.JSX.Element {
  const [hovering, setHovering] = useState<DropZoneType | undefined>(undefined);
  const [activeZone, setActiveZone] = useState<DropZoneType | undefined>(undefined);
  const { classes, cx } = useStyles();
  const dragLeaveTimeoutRef = useRef<NodeJS.Timeout>();

  const { onDrop: onDropProp, allowedExtensions, isRemote } = props;

  const { enqueueSnackbar } = useSnackbar();

  const onDragOver = useCallback(
    (event: globalThis.DragEvent) => {
      handleDragOver({
        allowedExtensions,
        dragLeaveTimeoutRef,
        event,
        hovering,
        isRemote,
        setActiveZone,
        setHovering,
      });
    },
    [allowedExtensions, hovering, isRemote],
  );

  const onDrop = useCallback(
    (ev: globalThis.DragEvent) => {
      if (!activeZone) {
        return;
      }
      void handleDrop({
        allowedExtensions,
        dropZone: activeZone,
        enqueueSnackbar,
        event: ev,
        onDrop: onDropProp,
        setActiveZone,
        setHovering,
      });
    },
    [activeZone, allowedExtensions, enqueueSnackbar, onDropProp],
  );

  const onDragLeave = useCallback(() => {
    // Apply timeout to avoid flickering when moving between elements
    dragLeaveTimeoutRef.current = setTimeout(() => {
      setHovering(undefined);
      setActiveZone(undefined);
    }, 50);
  }, []);

  useLayoutEffect(() => {
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragleave", onDragLeave);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragleave", onDragLeave);

      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
    };
  }, [onDragLeave, onDragOver, onDrop]);

  return (
    <>
      <input
        type="file"
        className={classes.hiddenFileInput}
        onChange={(event) => {
          if (event.target.files) {
            props.onDrop?.({
              files: Array.from(event.target.files),
              namespace: "local",
            });
          }
        }}
        data-puppeteer-file-upload
        multiple
      />
      {hovering && (
        <Dialog
          fullScreen
          open={true}
          style={{ zIndex: 10000000, pointerEvents: "none" }}
          PaperProps={{
            className: classes.overlay,
            style: {
              backgroundColor: "transparent",
              boxShadow: "none",
              pointerEvents: "none",
            },
          }}
        >
          <div className={classes.topRow}>
            {/* Local extensions drop zone */}
            <div
              className={cx(
                isRemote ? classes.dropZoneVertical : classes.dropZoneHorizontal,
                classes.dropZoneLocal,
                activeZone === "local" && classes.dropZoneActive,
              )}
              title={generateDropZoneHelpMessage("local")}
            >
              <div className={cx(classes.dropIndicator, classes.dropIndicatorLocal)}>
                Local Extensions or Layouts
                <div className={classes.dropExtensions}>
                  {LAYOUT_AND_EXTENSION_FILES.join(", ")}
                </div>
              </div>
            </div>

            {/* Organization extensions drop zone - only show when isRemote is true */}
            {isRemote && (
              <div
                className={cx(
                  classes.dropZoneVertical,
                  classes.dropZoneOrg,
                  activeZone === "org" && classes.dropZoneActive,
                )}
                title={generateDropZoneHelpMessage("org")}
              >
                <div className={cx(classes.dropIndicator, classes.dropIndicatorOrg)}>
                  Organization Extensions or Layouts
                  <div className={classes.dropExtensions}>
                    {LAYOUT_AND_EXTENSION_FILES.join(", ")}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom row: Full width for data sources */}
          <div className={classes.bottomRow}>
            <div
              className={cx(
                classes.dropZoneHorizontal,
                classes.dropZoneSource,
                activeZone === "source" && classes.dropZoneActive,
              )}
              title={generateDropZoneHelpMessage("source")}
            >
              <div className={cx(classes.dropIndicator, classes.dropIndicatorSource)}>
                Data Sources
                <div className={classes.dropExtensions}>{DATA_SOURCE_FILES.join(", ")}</div>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
