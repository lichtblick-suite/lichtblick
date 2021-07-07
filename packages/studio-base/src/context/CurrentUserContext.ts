// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export interface CurrentUser {
  email?: string;
}

const CurrentUserContext = createContext<CurrentUser | undefined>(undefined);

export function useCurrentUser(): CurrentUser | undefined {
  return useContext(CurrentUserContext);
}

export default CurrentUserContext;
