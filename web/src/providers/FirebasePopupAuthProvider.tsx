// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { getAuth, signInWithPopup, GoogleAuthProvider } from "@firebase/auth";
import { useCallback } from "react";

import { FirebaseAuthProvider, useFirebase } from "@foxglove/studio-firebase";

export default function FirebasePopupAuthProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const app = useFirebase();

  const getCredential = useCallback(async () => {
    const result = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential) {
      throw new Error("Unable to get credential");
    }
    return credential;
  }, [app]);

  return <FirebaseAuthProvider getCredential={getCredential}>{children}</FirebaseAuthProvider>;
}
