// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import subscribeToNewsletter from "./subscribeToNewsletter";

type SubscribeNewsletterFn = (email: string) => Promise<void> | void;

const SubscribeContext = createContext<SubscribeNewsletterFn>(subscribeToNewsletter);

function useSubscribeContext(): SubscribeNewsletterFn {
  return useContext(SubscribeContext);
}

export type { SubscribeNewsletterFn };
export { useSubscribeContext };
export default SubscribeContext;
