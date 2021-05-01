// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import { PlayerStatusIndicator } from "@foxglove-studio/app/components/PlayerStatusIndicator/PlayerStatusIndicator";
import ModalHost from "@foxglove-studio/app/context/ModalHost";
import { PlayerPresence } from "@foxglove-studio/app/players/types";

export default {
  title: "components/PlayerStatusIndicator/PlayerStatusIndicator",
  component: PlayerStatusIndicator,
};

export const SingleError = (): JSX.Element => {
  return (
    <ModalHost>
      <MockMessagePipelineProvider
        presence={PlayerPresence.ERROR}
        problems={[
          {
            severity: "error",
            message: "Some message",
            tip: "A tip that we might want to show the user",
            error: new Error("Original Error"),
          },
          {
            severity: "warning",
            message: "Some longer warning message about sadness",
          },
        ]}
      >
        <PlayerStatusIndicator />
      </MockMessagePipelineProvider>
    </ModalHost>
  );
};
