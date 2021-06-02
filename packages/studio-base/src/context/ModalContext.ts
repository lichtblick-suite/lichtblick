// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";

// The ModalContext provides a hook to render elements inside a modal host -- this is usually a
// provider of a theme that modal elements also need to access.
export default createContext<{
  // Add an element to the modal host.
  // Returns a function to remove the added element.
  addModalElement: (_: React.ReactNode) => () => void;
}>({
  addModalElement: () => () => {},
});
