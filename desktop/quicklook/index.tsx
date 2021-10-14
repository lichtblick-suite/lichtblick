// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/// <reference types="quicklookjs" />

import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useAsync } from "react-use";
import { createGlobalStyle } from "styled-components";

import Logger from "@foxglove/log";

import ErrorInfo from "./ErrorInfo";
import FileInfoDisplay from "./FileInfoDisplay";
import { getBagInfo, getMcapInfo } from "./getInfo";

const log = Logger.getLogger(__filename);

log.debug("initializing quicklook");

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }
  body,
  html {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
  }
  body {
    padding: 10px;
    font-family: ui-sans-serif, -apple-system;
  }
  pre, code, tt {
    font-family: ui-monospace, monospace;
  }
`;

function Root(): JSX.Element {
  const [previewedFile, setPreviewedFile] = useState<File | undefined>();

  // Allow dragging & dropping a file for easier debugging.
  useEffect(() => {
    const listener = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      if (e.type === "drop" && e.dataTransfer?.files[0]) {
        setPreviewedFile(e.dataTransfer.files[0]);
      }
    };
    document.addEventListener("dragover", listener);
    document.addEventListener("drop", listener);
    return () => {
      document.removeEventListener("dragover", listener);
      document.removeEventListener("drop", listener);
    };
  }, []);

  const state = useAsync(async () => {
    try {
      let file = previewedFile;
      if (!file && typeof quicklook !== "undefined") {
        file = await quicklook.getPreviewedFile();
      }
      if (!file) {
        return;
      }
      const fileStats = { name: file.name, size: file.size };
      const infoPromise = file.name.endsWith(".mcap") ? getMcapInfo(file) : getBagInfo(file);
      const { fileInfo, error } = await infoPromise
        .then((info) => ({ fileInfo: info, error: undefined }))
        .catch((err) => ({ fileInfo: undefined, error: err }));
      return { fileStats, fileInfo, error };
    } finally {
      if (typeof quicklook !== "undefined") {
        await quicklook.finishedLoading();
      }
    }
  }, [previewedFile]);
  useEffect(() => state.error && console.error(state.error), [state.error]);

  return (
    <div>
      {state.loading && "Loading…"}
      {state.error && <ErrorInfo>{state.error.toString()}</ErrorInfo>}
      {state.value && <FileInfoDisplay {...state.value} />}
    </div>
  );
}

ReactDOM.render(
  <>
    <GlobalStyle />
    <Root />
  </>,
  rootEl,
);
