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

import ExportVariantIcon from "@mdi/svg/svg/export-variant.svg";
import { useMemo, useState, useCallback } from "react";
import styled from "styled-components";

import { MouseEventObject } from "@foxglove/regl-worldview";
import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import Icon from "@foxglove/studio-base/components/Icon";
import Menu from "@foxglove/studio-base/components/Menu";
import Item from "@foxglove/studio-base/components/Menu/Item";
import { DecodedMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/decodeMarker";
import {
  getClickedInfo,
  getAllPoints,
  ClickedInfo,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/selection";
import clipboard from "@foxglove/studio-base/util/clipboard";
import { downloadFiles } from "@foxglove/studio-base/util/download";

import { SValue, SLabel } from "./styling";

const SRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0;
  margin: 4px 0;
`;
type Props = {
  selectedObject: MouseEventObject;
};

export default function PointCloudDetails({
  selectedObject: { object, instanceIndex },
}: Props): JSX.Element | ReactNull {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const { clickedPoint, clickedPointColor, additionalFieldValues } = useMemo(() => {
    return (
      getClickedInfo(object as unknown as DecodedMarker, instanceIndex) ??
      ({} as Partial<ClickedInfo>)
    );
  }, [instanceIndex, object]);

  const additionalFieldNames = useMemo(
    () => (additionalFieldValues && Object.keys(additionalFieldValues)) || [],
    [additionalFieldValues],
  );

  const hasAdditionalFieldNames = additionalFieldNames.length > 0;
  const onCopy = useCallback(() => {
    // GPU point clouds need to extract positions using getAllPoints()
    const allPoints: number[] =
      (object as { points?: number[] }).points ?? getAllPoints(object as unknown as DecodedMarker);
    const dataRows = [];
    const len = allPoints.length / 3;
    // get copy data
    for (let i = 0; i < len; i++) {
      const rowData = [allPoints[i * 3], allPoints[i * 3 + 1], allPoints[i * 3 + 2]];
      rowData.push(
        ...additionalFieldNames.map(
          (fieldName) => (object as unknown as Record<string, number[]>)?.[fieldName]?.[i],
        ),
      );
      dataRows.push(rowData.join(","));
    }

    const additionalColumns = hasAdditionalFieldNames ? `,${additionalFieldNames.join(",")}` : "";
    const dataStr = `x,y,z${additionalColumns}\n${dataRows.join("\n")}`;
    const blob = new Blob([dataStr], { type: "text/csv;charset=utf-8;" });
    downloadFiles([{ blob, fileName: "PointCloud.csv" }]);
    setIsOpen(false);
  }, [additionalFieldNames, hasAdditionalFieldNames, object]);

  if (!clickedPoint) {
    return ReactNull;
  }

  const colorStyle = clickedPointColor ? { color: `rgba(${clickedPointColor.join(",")})` } : {};

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ChildToggle position="below" onToggle={setIsOpen} isOpen={isOpen}>
          <Icon
            size="small"
            fade
            active={isOpen}
            tooltip={hasAdditionalFieldNames ? "Export points and fields" : "Export points"}
          >
            <ExportVariantIcon />
          </Icon>
          <Menu>
            <Item
              onClick={() => {
                void clipboard.copy(clickedPoint.join(", ")).then(() => {
                  setIsOpen(false);
                });
              }}
            >
              Copy clicked point to clipboard
            </Item>
            <Item onClick={onCopy}>
              {hasAdditionalFieldNames
                ? "Download all points and fields as CSV"
                : "Download all points as CSV"}
            </Item>
          </Menu>
        </ChildToggle>
      </div>
      <SRow>
        <SLabel width={hasAdditionalFieldNames ? 72 : 44}>Point:</SLabel>
        <SValue style={{ flex: 1, lineHeight: 1.4, ...colorStyle }}>
          {clickedPoint.map((x) => (typeof x === "number" ? x : JSON.stringify(x))).join(", ")}
        </SValue>
      </SRow>
      {additionalFieldValues && (
        <>
          {Object.keys(additionalFieldValues).map((fieldName) => (
            <SRow key={fieldName}>
              <SLabel width={72}>{fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}:</SLabel>
              <SValue>{additionalFieldValues[fieldName]}</SValue>
            </SRow>
          ))}
        </>
      )}
    </>
  );
}
