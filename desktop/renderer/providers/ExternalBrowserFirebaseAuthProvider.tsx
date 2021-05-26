// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { OAuthCredential } from "@firebase/auth";
import { useCallback } from "react";

import { FirebaseAuthProvider } from "@foxglove/studio-base";

import { Desktop } from "../../common/types";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;

export default function ExternalBrowserFirebaseAuthProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const getCredentialViaExternalBrowser = useCallback(async () => {
    const params = new URLSearchParams(await desktopBridge.authenticateViaExternalBrowser());
    const credentialStr = params.get("credential");
    if (credentialStr == undefined) {
      throw new Error(`No data was returned from the browser.`);
    }
    const oauthCredential = OAuthCredential.fromJSON(credentialStr);
    if (oauthCredential == undefined) {
      throw new Error("Data does not represent a valid OAuth credential.");
    }
    return oauthCredential;
  }, []);

  return (
    <FirebaseAuthProvider getCredential={getCredentialViaExternalBrowser}>
      {children}
    </FirebaseAuthProvider>
  );
}
