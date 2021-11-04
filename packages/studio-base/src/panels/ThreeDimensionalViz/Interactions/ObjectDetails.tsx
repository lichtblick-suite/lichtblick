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
import { useCallback } from "react";
import Tree from "react-json-tree";
import styled from "styled-components";

import { MouseEventObject } from "@foxglove/regl-worldview";
import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import useGetItemStringWithTimezone from "@foxglove/studio-base/components/JsonTree/useGetItemStringWithTimezone";
import styles from "@foxglove/studio-base/panels/ThreeDimensionalViz/sharedStyles";
import { getInstanceObj } from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import GlobalVariableLink from "./GlobalVariableLink/index";
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

const SObjectDetails = styled.div`
  padding: 12px 0 16px 0;
`;

type CommonProps = { readonly interactionData?: InteractionData };

type WrapperProps = CommonProps & { readonly selectedObject: MouseEventObject };

type Props = CommonProps & { readonly objectToDisplay: unknown };

// Used for switching between views of individual and combined objects.
// TODO(steel): Only show the combined object when the individual objects are semantically related.
export default function ObjectDetails({
  interactionData,
  selectedObject: { object, instanceIndex },
}: WrapperProps): JSX.Element {
  const [showInstance, setShowInstance] = React.useState(true);
  const instanceObject = getInstanceObj(object, instanceIndex as number);
  const dropdownText = {
    instance: "Show instance object",
    full: "Show full object",
  };

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  const updateShowInstance = useCallback((shouldShowInstance: boolean) => {
    setShowInstance(shouldShowInstance);
  }, []);

  const objectToDisplay = instanceObject != undefined && showInstance ? instanceObject : object;
  return (
    <div>
      {instanceObject != undefined && (
        <Dropdown
          btnClassname={styles.button}
          position="below"
          value={showInstance}
          text={showInstance ? dropdownText.instance : dropdownText.full}
          onChange={updateShowInstance}
        >
          <DropdownItem value={true}>
            <span>{dropdownText.instance}</span>
          </DropdownItem>
          <DropdownItem value={false}>
            <span>{dropdownText.full}</span>
          </DropdownItem>
        </Dropdown>
      )}
      <ObjectDetailsInner interactionData={interactionData} objectToDisplay={objectToDisplay} />
    </div>
  );
}

function maybePlainObject(rawVal: unknown) {
  if (typeof rawVal === "object" && rawVal && "toJSON" in rawVal) {
    return (rawVal as { toJSON: () => unknown }).toJSON();
  }
  return rawVal;
}

function ObjectDetailsInner({ interactionData, objectToDisplay }: Props) {
  const jsonTreeTheme = useJsonTreeTheme();
  const topic = interactionData?.topic ?? "";

  // object to display may not be a plain-ole-data
  // We need a plain object to sort the keys and omit interaction data
  const plainObject =
    "toJSON" in (objectToDisplay as { toJSON?: () => unknown })
      ? (objectToDisplay as { toJSON: () => unknown }).toJSON()
      : objectToDisplay;
  const originalObject = omit(plainObject as Record<string, unknown>, "interactionData");

  const getItemString = useGetItemStringWithTimezone();

  if (topic.length === 0) {
    // show the original object directly if there is no interaction data. e.g. DrawPolygons
    return (
      <SObjectDetails>
        <Tree
          data={objectToDisplay}
          shouldExpandNode={(_markerKeyPath, _data, level) => level < 2}
          invertTheme={false}
          postprocessValue={maybePlainObject}
          theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          hideRoot
        />
      </SObjectDetails>
    );
  }

  const sortedDataObject = Object.fromEntries(
    sortBy(Object.keys(originalObject), (key) => -PREFERRED_OBJECT_KEY_ORDER.indexOf(key)).map(
      (key) => [key, originalObject[key]],
    ),
  );

  return (
    <SObjectDetails>
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
                style={{ marginLeft: 4 }}
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
              style={{ marginLeft: 16 }}
              label={label}
              markerKeyPath={markerKeyPath.map((item) => item.toString())}
              topic={topic}
              variableValue={itemValue}
            />
          );
        }}
      />
    </SObjectDetails>
  );
}
