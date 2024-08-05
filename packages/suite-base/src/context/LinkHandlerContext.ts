// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { createContext } from "react";

// This context provides a function that handles link clicks, for example to handle app-internal
// links by showing a modal dialog rather than actualy navigating.
const LinkHandlerContext = createContext<(event: React.MouseEvent, href: string) => void>(() => {});
LinkHandlerContext.displayName = "LinkHandlerContext";

export default LinkHandlerContext;
