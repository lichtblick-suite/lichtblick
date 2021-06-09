// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/// <reference types="quicklookjs" />

import ReactDOM from "react-dom";
import { useAsync } from "react-use";
import { createGlobalStyle } from "styled-components";

import Logger from "@foxglove/log";

import BagInfoDisplay from "./BagInfoDisplay";
import getBagInfo from "./getBagInfo";

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
  const state = useAsync(async () => {
    try {
      const file = await quicklook.getPreviewedFile();
      const fileInfo = { name: file.name, size: file.size };
      const { bagInfo, error } = await getBagInfo(file)
        .then((info) => ({ bagInfo: info, error: undefined }))
        .catch((err) => ({ bagInfo: undefined, error: err }));
      return { fileInfo, bagInfo, error };
    } finally {
      await quicklook.finishedLoading();
    }
  }, []);

  return (
    <div>
      {state.loading && "Loading…"}
      {state.value && <BagInfoDisplay {...state.value} />}
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
