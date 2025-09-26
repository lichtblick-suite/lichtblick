// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Dialog } from "@mui/material";
import { useSnackbar } from "notistack";
import { extname } from "path";
import { useCallback, useLayoutEffect, useState, useRef } from "react";

import Logger from "@lichtblick/log";
import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import { ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

import { useStyles } from "./MultiDropZoneListener.style";

const log = Logger.getLogger(__filename);

type DropZoneType = ExtensionNamespace | "source";

export type MultiDropZoneListenerProps = {
  allowedExtensions?: string[];
  isRemote: boolean;
  onDrop?: (event: {
    files?: File[];
    handles?: FileSystemFileHandle[];
    namespace?: ExtensionNamespace;
    isSource?: boolean;
  }) => void;
};

export default function MultiDropZoneListener(
  props: MultiDropZoneListenerProps,
): React.JSX.Element {
  const [hovering, setHovering] = useState<DropZoneType | undefined>(undefined);
  const [activeZone, setActiveZone] = useState<DropZoneType | undefined>(undefined);
  const { classes, cx } = useStyles();
  const dragLeaveTimeoutRef = useRef<NodeJS.Timeout>();

  const layoutAndExtensionsFiles = [AllowedFileExtensions.JSON, AllowedFileExtensions.FOXE];
  const dataSourceFiles = [
    AllowedFileExtensions.MCAP,
    AllowedFileExtensions.BAG,
    AllowedFileExtensions.DB3,
    AllowedFileExtensions.ULG,
    AllowedFileExtensions.ULOG,
  ];

  const { onDrop: onDropProp, allowedExtensions, isRemote } = props;

  const { enqueueSnackbar } = useSnackbar();

  const handleDrop = useCallback(
    async (ev: globalThis.DragEvent, dropZone: DropZoneType) => {
      setHovering(undefined);
      setActiveZone(undefined);

      if (!ev.dataTransfer || !allowedExtensions) {
        return;
      }

      let handles: FileSystemFileHandle[] | undefined = [];
      const handlePromises: Promise<FileSystemHandle | ReactNull>[] = [];
      const allFiles: File[] = [];
      const directories: FileSystemDirectoryEntry[] = [];
      const dataItems = ev.dataTransfer.items;
      for (const item of Array.from(dataItems)) {
        if (window.isSecureContext && "getAsFileSystemHandle" in item) {
          handlePromises.push(item.getAsFileSystemHandle());
        } else {
          log.info(
            "getAsFileSystemHandle not available on a dropped item. Features requiring handles will not be available for the item",
            item,
          );
        }

        const entry = item.webkitGetAsEntry();

        if (entry?.isFile === true) {
          const file = item.getAsFile();
          if (file) {
            allFiles.push(file);
          }
        } else if (entry?.isDirectory === true) {
          directories.push(entry as FileSystemDirectoryEntry);
        }
      }

      if (directories.length === 0) {
        for (const promise of handlePromises) {
          const fileSystemHandle = await promise;
          if (fileSystemHandle instanceof FileSystemFileHandle) {
            handles.push(fileSystemHandle);
          }
        }
      }

      if (allFiles.length === 0 && directories.length === 0 && handles.length === 0) {
        return;
      }

      for (const directory of directories) {
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          directory.createReader().readEntries(resolve, reject);
        });

        for (const entry of entries) {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve, reject) => {
              (entry as FileSystemFileEntry).file(resolve, reject);
            });
            allFiles.push(file);
          }
        }
      }

      if (directories.length > 0 || handles.length === 0) {
        handles = undefined;
      }

      const filteredFiles = allFiles.filter((file) =>
        allowedExtensions.includes(extname(file.name)),
      );
      const filteredHandles = handles?.filter((handle) =>
        allowedExtensions.includes(extname(handle.name)),
      );

      if (filteredFiles.length === 0 && filteredHandles?.length === 0) {
        enqueueSnackbar("The file format is not supported.", { variant: "error" });
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      let namespace: ExtensionNamespace | undefined;
      let isSource = false;

      if (dropZone === "source") {
        isSource = true;
      } else {
        namespace = dropZone;
      }

      onDropProp?.({ files: filteredFiles, handles: filteredHandles, namespace, isSource });
    },
    [enqueueSnackbar, onDropProp, allowedExtensions],
  );

  const onDragOver = useCallback(
    (ev: globalThis.DragEvent) => {
      if (!allowedExtensions) {
        return;
      }

      const { dataTransfer } = ev;
      if (dataTransfer?.types.includes("Files") === true) {
        ev.stopPropagation();
        ev.preventDefault();
        dataTransfer.dropEffect = "copy";

        // Clear timeout if still pending
        if (dragLeaveTimeoutRef.current) {
          clearTimeout(dragLeaveTimeoutRef.current);
          dragLeaveTimeoutRef.current = undefined;
        }

        const topSection = window.innerHeight * 0.55; // Top 55%

        if (!hovering) {
          setHovering("local");
        }

        if (ev.clientY < topSection) {
          if (isRemote) {
            // When remote: left/right split for local/org extensions
            const isLeftSide = ev.clientX < window.innerWidth / 2;
            setActiveZone(isLeftSide ? "local" : "org");
          } else {
            // When not remote: entire top section is local extensions
            setActiveZone("local");
          }
        } else {
          // Bottom section - data sources (always available)
          setActiveZone("source");
        }
      }
    },
    [allowedExtensions, hovering, isRemote],
  );

  const onDrop = useCallback(
    (ev: globalThis.DragEvent) => {
      if (!activeZone) {
        return;
      }
      void handleDrop(ev, activeZone);
    },
    [handleDrop, activeZone],
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
            >
              <div className={cx(classes.dropIndicator, classes.dropIndicatorLocal)}>
                Local Extensions or Layouts
                <div className={classes.dropExtensions}>{layoutAndExtensionsFiles.join(", ")}</div>
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
              >
                <div className={cx(classes.dropIndicator, classes.dropIndicatorOrg)}>
                  Organization Extensions or Layouts
                  <div className={classes.dropExtensions}>
                    {layoutAndExtensionsFiles.join(", ")}
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
            >
              <div className={cx(classes.dropIndicator, classes.dropIndicatorSource)}>
                Data Sources
                <div className={classes.dropExtensions}>{dataSourceFiles.join(", ")}</div>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
