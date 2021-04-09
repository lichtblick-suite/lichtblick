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

import { PolygonBuilder, Polygon } from "regl-worldview";
import styled from "styled-components";

import Button from "@foxglove-studio/app/components/Button";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import ValidatedInput, { EditFormat } from "@foxglove-studio/app/components/ValidatedInput";
import {
  SValue,
  SLabel,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/styling";
import {
  polygonsToPoints,
  getFormattedString,
  pointsToPolygons,
  getPolygonLineDistances,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/utils/drawToolUtils";
import clipboard from "@foxglove-studio/app/util/clipboard";
import { polygonPointsValidator } from "@foxglove-studio/app/util/validators";

export type Point2D = { x: number; y: number };

export const SRow = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 0;
`;

type Props = {
  onSetPolygons: (polygons: Polygon[]) => void;
  polygonBuilder: PolygonBuilder;
  selectedPolygonEditFormat: EditFormat;
};

export default function Polygons({
  onSetPolygons,
  polygonBuilder,
  selectedPolygonEditFormat,
}: Props) {
  const { saveConfig } = React.useContext(PanelContext) || {};
  const polygons: Polygon[] = polygonBuilder.polygons;
  const [polygonPoints, setPolygonPoints] = React.useState<Point2D[][]>(() =>
    polygonsToPoints(polygons),
  );
  function polygonBuilderOnChange() {
    setPolygonPoints(polygonsToPoints(polygons));
  }
  polygonBuilder.onChange = polygonBuilderOnChange;

  return (
    <>
      <ValidatedInput
        format={selectedPolygonEditFormat}
        value={polygonPoints}
        onSelectFormat={(selectedFormat) =>
          (saveConfig as any)({ selectedPolygonEditFormat: selectedFormat })
        }
        onChange={(newPolygonPoints) => {
          if (newPolygonPoints) {
            setPolygonPoints(newPolygonPoints);
            onSetPolygons(pointsToPolygons(newPolygonPoints));
          }
        }}
        dataValidator={polygonPointsValidator}
      >
        <Button
          small
          tooltip="Copy Polygons"
          onClick={() => {
            clipboard.copy(getFormattedString(polygonPoints, selectedPolygonEditFormat));
          }}
        >
          Copy
        </Button>
      </ValidatedInput>
      <SRow>
        <SLabel>Total length:</SLabel>
        <SValue>{getPolygonLineDistances(polygonPoints).toFixed(2)} m</SValue>
      </SRow>
      <p style={{ marginTop: 0 }}>
        <em>
          Start drawing by holding <b>ctrl</b> and clicking on the 3D panel.
        </em>
      </p>
    </>
  );
}
