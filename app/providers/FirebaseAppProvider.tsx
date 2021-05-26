// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { FirebaseApp, initializeApp, deleteApp, FirebaseOptions } from "@firebase/app";
import { useLayoutEffect, useState } from "react";

import Logger from "@foxglove/log";
import { FirebaseAppContext } from "@foxglove/studio-base/context/FirebaseAppContext";

const log = Logger.getLogger(__filename);

/** Initialize a Firebase app from the given config object. */
export default function FirebaseAppProvider({
  config,
  children,
}: React.PropsWithChildren<{ config: FirebaseOptions }>): JSX.Element | ReactNull {
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | undefined>(undefined);
  useLayoutEffect(() => {
    const app = initializeApp(config);
    setFirebaseApp(app);
    return () => {
      // Gracefully tear down the app to avoid errors during hot reloading
      deleteApp(app).catch((err) => log.error("Failed to delete Firebase app:", err));
    };
  }, [config]);
  if (!firebaseApp) {
    return ReactNull;
  }
  return <FirebaseAppContext.Provider value={firebaseApp}>{children}</FirebaseAppContext.Provider>;
}
