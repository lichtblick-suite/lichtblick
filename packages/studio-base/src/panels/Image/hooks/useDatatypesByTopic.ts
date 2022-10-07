// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";

export function useDatatypesByTopic(): Map<string, string> {
  const { topics } = useDataSourceInfo();

  return useMemo(() => {
    const out = new Map<string, string>();
    for (const topic of topics) {
      out.set(topic.name, topic.schemaName);
    }
    return out;
  }, [topics]);
}
