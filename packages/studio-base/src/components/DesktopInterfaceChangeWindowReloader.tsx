// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";

/**
 * Utility component that forces the main window to reload on desktop when switching
 * between old & new UI.
 */
export function DesktopInterfaceChangeWindowReloader(props: {
  reloadWindow: () => void;
}): ReactNull {
  const [enableNewUI = false] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);
  const [initialNewUI] = useState(enableNewUI);

  useEffect(() => {
    if (initialNewUI !== enableNewUI) {
      props.reloadWindow();
    }
  }, [enableNewUI, initialNewUI, props]);

  return ReactNull;
}
