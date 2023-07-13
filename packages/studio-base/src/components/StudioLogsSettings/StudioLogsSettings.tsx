// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SettingsTreeEditor from "@foxglove/studio-base/components/SettingsTreeEditor";

import { useStudioLogsSettingsTree } from "./useStudioLogsSettingsTree";

export function StudioLogsSettings(): JSX.Element {
  const logSettings = useStudioLogsSettingsTree();

  return <SettingsTreeEditor variant="log" settings={logSettings} />;
}
