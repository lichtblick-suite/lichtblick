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
import NukeIcon from "@mdi/svg/svg/nuke.svg";

import { Item } from "@foxglove-studio/app/components/Menu";
import useConfirm from "@foxglove-studio/app/components/useConfirm";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import { clearIndexedDbWithoutConfirmation } from "@foxglove-studio/app/util/indexeddb/clearIndexedDb";

export default function ClearBagCacheMenuItem(): React.ReactElement | null {
  const { modal, open } = useConfirm({
    prompt:
      "This will clear out all locally cached bag data from IndexedDB.\n\nUse this if you're having consistency or performance issues (but then please still report them to us!).\n\nThis will only work if you've closed all Webviz windows, since we cannot delete active databases.",
    ok: "Clear bag cache",
    action(ok) {
      if (ok) {
        // From https://stackoverflow.com/a/54764150
        clearIndexedDbWithoutConfirmation().then(() => {
          window.location.reload();
        });
      }
    },
  });
  if (!useExperimentalFeature("diskBagCaching")) {
    return null;
  }
  return (
    <Item icon={<NukeIcon />} onClick={open}>
      {modal}
      Clear bag cache
    </Item>
  );
}
