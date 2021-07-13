// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

// ReadySignal is a function that indicates the story is ready
type ReadySignal = () => void;

const ReadySignalContext = createContext<ReadySignal | undefined>(undefined);

function useReadySignal(): ReadySignal {
  const readySignal = useContext(ReadySignalContext);
  if (!readySignal) {
    throw new Error("Add a signal to the story screenshot parameters");
  }
  return readySignal;
}

export { useReadySignal };
export default ReadySignalContext;
