// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import * as _ from "lodash-es";
import Tree from "react-json-tree";

import Stack from "@foxglove/studio-base/components/Stack";
import { RosValue } from "@foxglove/studio-base/players/types";
import { getItemString } from "@foxglove/studio-base/util/getItemString";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { InteractionData } from "./types";

type Props = {
  readonly interactionData?: InteractionData;
  readonly selectedObject?: RosValue;
  readonly timezone: string | undefined;
};

function ObjectDetails({ interactionData, selectedObject, timezone }: Props): JSX.Element {
  const jsonTreeTheme = useJsonTreeTheme();
  const topic = interactionData?.topic ?? "";

  const originalObject = _.omit(selectedObject as Record<string, unknown>, "interactionData");

  if (topic.length === 0) {
    // show the original object directly if there is no interaction data
    return (
      <Stack paddingY={1}>
        <Tree
          data={selectedObject}
          shouldExpandNode={(_markerKeyPath, _data, level) => level < 2}
          invertTheme={false}
          theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          hideRoot
        />
      </Stack>
    );
  }

  return (
    <Stack paddingY={1}>
      <Tree
        data={originalObject}
        shouldExpandNode={() => false}
        invertTheme={false}
        theme={{ ...jsonTreeTheme, tree: { margin: 0, whiteSpace: "pre-line" } }}
        hideRoot
        getItemString={(nodeType, data, itemType, itemString, keyPath) =>
          getItemString(nodeType, data, itemType, itemString, keyPath, timezone)
        }
        labelRenderer={(markerKeyPath, _p1, _p2, _hasChildren) => {
          const label = _.first(markerKeyPath);
          return <span style={{ padding: "0 4px 0 0" }}>{label}</span>;
        }}
        valueRenderer={(label: string) => {
          return <span>{label}</span>;
        }}
      />
    </Stack>
  );
}

export default ObjectDetails;
