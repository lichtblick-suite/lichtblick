// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageBar, MessageBarType } from "@fluentui/react";
import { useLayoutEffect, useState } from "react";
import { useAsync } from "react-use";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { Asset } from "@foxglove/studio-base/context/AssetsContext";
import URDFAssetLoader from "@foxglove/studio-base/services/URDFAssetLoader";
import { ROBOT_DESCRIPTION_PARAM } from "@foxglove/studio-base/util/globalConstants";

export default function useRobotDescriptionAsset(): {
  robotDescriptionAsset: Asset | undefined;
  messageBar: React.ReactNode;
} {
  const [robotDescriptionParam] = PanelAPI.useParameter<string>(ROBOT_DESCRIPTION_PARAM);
  const [assetErrorDismissed, setAssetErrorDismissed] = useState(false);

  const { value: robotDescriptionAsset, error: robotDescriptionAssetError } = useAsync(async () => {
    if (robotDescriptionParam == undefined) {
      return undefined;
    }
    return await new URDFAssetLoader().load(
      new File([robotDescriptionParam], "robot_description.urdf"),
      {
        basePath: undefined,
      },
    );
  }, [robotDescriptionParam]);

  const messageBar = robotDescriptionAssetError && !assetErrorDismissed && (
    <MessageBar
      messageBarType={MessageBarType.warning}
      onDismiss={() => setAssetErrorDismissed(true)}
    >
      {robotDescriptionAssetError.toString()}
    </MessageBar>
  );

  // When the error changes, show the message bar again if the user previously dismissed it.
  useLayoutEffect(() => {
    if (robotDescriptionAssetError) {
      setAssetErrorDismissed(false);
    }
  }, [robotDescriptionAssetError]);

  return { robotDescriptionAsset, messageBar };
}
