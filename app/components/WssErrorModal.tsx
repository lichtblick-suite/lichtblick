// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import imageSrc from "./WssErrorModal.png";
import HelpModal from "@foxglove-studio/app/components/HelpModal";

export default function WssErrorModal(props: { onRequestClose: () => void }) {
  return (
    <HelpModal onRequestClose={props.onRequestClose}>
      <h1>WebSocket SSL Error</h1>
      <p>
        Chrome prevents connecting to a websocket which is not served over TLS/SSL. For now you can
        circumvent this by enabling &quot;unsafe&quot; scripts for this page.
      </p>
      <p>
        Click the shield icon at the end of your address bar, and then click &quot;Load unsafe
        scripts.&quot;
      </p>
      <img width="450px" src={imageSrc} alt="wss error fix" />
    </HelpModal>
  );
}
