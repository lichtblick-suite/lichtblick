// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

// by default, modal dialogs are appended to the document body
// providing a value to this context will instead cause modals
// to be appended to the DOM node whose id matches the provided value
const DialogHostIdContext = createContext<string | undefined>(undefined);
DialogHostIdContext.displayName = "DialogHostIdContext";

function useDialogHostId(): string | undefined {
  return useContext(DialogHostIdContext);
}

export { useDialogHostId };
export default DialogHostIdContext;
