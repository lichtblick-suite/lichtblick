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

import { first, omit } from "lodash";
import Tree from "react-json-tree";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { RosValue } from "@foxglove/studio-base/players/types";
import { getItemString } from "@foxglove/studio-base/util/getItemString";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { InteractionData } from "./types";

type Props = {
  readonly interactionData?: InteractionData;
  readonly selectedObject?: RosValue;
};

function maybePlainObject(rawVal: unknown) {
  if (typeof rawVal === "object" && rawVal && "toJSON" in rawVal) {
    return (rawVal as { toJSON: () => unknown }).toJSON();
  }
  return rawVal;
}

function ObjectDetails({ interactionData, selectedObject }: Props): JSX.Element {
  const jsonTreeTheme = useJsonTreeTheme();
  const topic = interactionData?.topic ?? "";

  // object to display may not be a plain-ole-data
  // We need a plain object to sort the keys and omit interaction data
  const plainObject = maybePlainObject(selectedObject);
  const originalObject = omit(plainObject as Record<string, unknown>, "interactionData");

  const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);

  if (topic.length === 0) {
    // show the original object directly if there is no interaction data
    return (
      <Stack paddingY={1}>
        <Tree
          data={selectedObject}
          shouldExpandNode={(_markerKeyPath, _data, level) => level < 2}
          invertTheme={false}
          postprocessValue={maybePlainObject}
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
        postprocessValue={maybePlainObject}
        labelRenderer={(markerKeyPath, _p1, _p2, _hasChildren) => {
          const label = first(markerKeyPath);
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
