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

import { first, omit, sortBy } from "lodash";
import Tree from "react-json-tree";
import styled from "styled-components";

import GlobalVariableLink from "@foxglove/studio-base/components/GlobalVariableLink";
import useGetItemStringWithTimezone from "@foxglove/studio-base/components/JsonTree/useGetItemStringWithTimezone";
import { RosValue } from "@foxglove/studio-base/players/types";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { InteractionData } from "./types";

// Sort the keys of objects to make their presentation more predictable
const PREFERRED_OBJECT_KEY_ORDER = [
  "id",
  "ns",
  "type",
  "action",
  "header",
  "lifetime",
  "color",
  "colors",
  "pose",
  "points",
].reverse();

const TreeContainer = styled.div`
  padding: 12px 0 16px 0;
`;

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

  const getItemString = useGetItemStringWithTimezone();

  if (topic.length === 0) {
    // show the original object directly if there is no interaction data
    return (
      <TreeContainer>
        <Tree
          data={selectedObject}
          shouldExpandNode={(_markerKeyPath, _data, level) => level < 2}
          invertTheme={false}
          postprocessValue={maybePlainObject}
          theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          hideRoot
        />
      </TreeContainer>
    );
  }

  const sortedDataObject = Object.fromEntries(
    sortBy(Object.keys(originalObject), (key) => -PREFERRED_OBJECT_KEY_ORDER.indexOf(key)).map(
      (key) => [key, originalObject[key]],
    ),
  );

  return (
    <TreeContainer>
      <Tree
        data={sortedDataObject}
        shouldExpandNode={() => false}
        invertTheme={false}
        theme={{ ...jsonTreeTheme, tree: { margin: 0, whiteSpace: "pre-line" } }}
        hideRoot
        getItemString={getItemString}
        postprocessValue={maybePlainObject}
        labelRenderer={(markerKeyPath, _p1, _p2, hasChildren) => {
          const label = first(markerKeyPath);
          if (!hasChildren) {
            return <span style={{ padding: "0 4px 0 0" }}>{label}</span>;
          }

          let objectForPath: Record<string, unknown> | undefined = sortedDataObject;
          for (let i = markerKeyPath.length - 1; i >= 0; i--) {
            objectForPath = objectForPath[markerKeyPath[i]!] as Record<string, unknown> | undefined;
            if (!objectForPath) {
              break;
            }
          }

          if (objectForPath) {
            return (
              <GlobalVariableLink
                hasNestedValue
                label={label?.toString()}
                markerKeyPath={markerKeyPath.map((item) => item.toString())}
                topic={topic}
                variableValue={objectForPath}
              />
            );
          }
          return <></>;
        }}
        valueRenderer={(
          label: string,
          itemValue: unknown,
          ...markerKeyPath: (string | number)[]
        ) => {
          return (
            <GlobalVariableLink
              label={label}
              markerKeyPath={markerKeyPath.map((item) => item.toString())}
              topic={topic}
              variableValue={itemValue}
            />
          );
        }}
      />
    </TreeContainer>
  );
}

export default ObjectDetails;
