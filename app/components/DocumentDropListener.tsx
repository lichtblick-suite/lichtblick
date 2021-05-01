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

import { extname } from "path";
import { useCallback, useLayoutEffect, useState } from "react";
import { useToasts } from "react-toast-notifications";

type Props = {
  children: React.ReactNode; // Shown when dragging in a file.
  allowedExtensions?: string[];
  filesSelected?: (arg: { files: FileList; shiftPressed: boolean }) => void;
};

export default function DocumentDropListener(props: Props): JSX.Element {
  const [hovering, setHovering] = useState(false);

  const { filesSelected, allowedExtensions } = props;

  const { addToast } = useToasts();

  const onDrop = useCallback(
    (ev: DragEvent) => {
      setHovering(false);

      if (!ev.dataTransfer) {
        return;
      }
      const { files } = ev.dataTransfer;
      // allow event to bubble for non-file based drag and drop
      if (files.length === 0 || !allowedExtensions) {
        return;
      }

      const containsUnsupportedFiles = Array.from(files).some((file) => {
        const fileExtension = extname(file.name);
        return !allowedExtensions.includes(fileExtension);
      });
      if (containsUnsupportedFiles) {
        addToast("The file format is unsupported.", {
          appearance: "error",
        });
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();
      filesSelected?.({ files, shiftPressed: ev.shiftKey });
    },
    [addToast, filesSelected, allowedExtensions],
  );

  const onDragOver = useCallback(
    (ev: DragEvent) => {
      if (!allowedExtensions) {
        return;
      }

      const { dataTransfer } = ev;
      if (dataTransfer?.types[0] === "Files") {
        ev.stopPropagation();
        ev.preventDefault();
        dataTransfer.dropEffect = "copy";
        setHovering(true);
      }
    },
    [allowedExtensions],
  );

  const onDragLeave = useCallback(() => {
    setHovering(false);
  }, []);

  useLayoutEffect(() => {
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragleave", onDragLeave);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragleave", onDragLeave);
    };
  }, [onDragLeave, onDragOver, onDrop]);

  return (
    <>
      <input // Expose a hidden input for Puppeteer to use to drop a file in.
        type="file"
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.target.files) {
            props.filesSelected?.({ files: event.target.files, shiftPressed: false });
          }
        }}
        data-puppeteer-file-upload
        multiple
      />
      {hovering && props.children}
    </>
  );
}
