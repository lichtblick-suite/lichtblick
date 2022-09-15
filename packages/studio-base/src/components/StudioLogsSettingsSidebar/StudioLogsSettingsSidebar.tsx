// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SettingsTreeEditor from "@foxglove/studio-base/components/SettingsTreeEditor";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";

import { useStudioLogsSettingsTree } from "./useStudioLogsSettingsTree";

function StudioLogsSettingsSidebar(): JSX.Element {
  const logSettings = useStudioLogsSettingsTree();

  return (
    <SidebarContent overflow="auto" title="Studio Logs Settings" disablePadding>
      <SettingsTreeEditor settings={logSettings} />
    </SidebarContent>
  );
}

export { StudioLogsSettingsSidebar };
