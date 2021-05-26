// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { FirebaseApp } from "@firebase/app";
import { createContext, useContext } from "react";

export const FirebaseAppContext = createContext<FirebaseApp | undefined>(undefined);

export function useFirebase(): FirebaseApp {
  const ctx = useContext(FirebaseAppContext);
  if (ctx === undefined) {
    throw new Error("A FirebaseAppContext provider is required to useFirebase");
  }
  return ctx;
}

export default FirebaseAppContext;
