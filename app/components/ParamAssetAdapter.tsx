// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import { useMountedState } from "react-use";

import { useParameter } from "@foxglove-studio/app/PanelAPI";
import { useAssets } from "@foxglove-studio/app/context/AssetContext";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

/**
 * Listen to the ROS parameter /robot_description and load the URDF asset from this parameter.
 */
export default function ParamAssetAdapter(): ReactNull {
  const [modelFromParam] = useParameter<string>("/robot_description");
  const { loadFromFile } = useAssets();
  const isMounted = useMountedState();

  useEffect(() => {
    (async () => {
      if (modelFromParam != undefined) {
        try {
          await loadFromFile(new File([modelFromParam], "robot_description.urdf"), undefined);
        } catch (err) {
          if (isMounted()) {
            sendNotification("Error loading URDF from /robot_description", err, "user", "warn");
          }
        }
      }
    })();
  }, [modelFromParam, loadFromFile, isMounted]);

  return ReactNull;
}
