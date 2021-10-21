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

import styled from "styled-components";

import { PolygonBuilder, Polygon } from "@foxglove/regl-worldview";
import Button from "@foxglove/studio-base/components/Button";
import ValidatedInput from "@foxglove/studio-base/components/ValidatedInput";
import {
  SValue,
  SLabel,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/styling";
import styles from "@foxglove/studio-base/panels/ThreeDimensionalViz/sharedStyles";
import {
  polygonsToPoints,
  getFormattedString,
  pointsToPolygons,
  getPolygonLineDistances,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/drawToolUtils";
import clipboard from "@foxglove/studio-base/util/clipboard";
import { polygonPointsValidator } from "@foxglove/studio-base/util/validators";

export type Point2D = { x: number; y: number };

export const SRow = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 0;
`;

type Props = {
  onSetPolygons: (polygons: Polygon[]) => void;
  polygonBuilder: PolygonBuilder;
};

export default function Polygons({ onSetPolygons, polygonBuilder }: Props): JSX.Element {
  const polygons: Polygon[] = polygonBuilder.polygons;
  const [polygonPoints, setPolygonPoints] = React.useState<Point2D[][]>(() =>
    polygonsToPoints(polygons),
  );
  function polygonBuilderOnChange() {
    setPolygonPoints(polygonsToPoints(polygons));
  }
  polygonBuilder.onChange = polygonBuilderOnChange;

  return (
    <div style={{ padding: 8 }}>
      <ValidatedInput
        value={polygonPoints}
        onChange={(newPolygonPoints) => {
          if (newPolygonPoints != undefined) {
            setPolygonPoints(newPolygonPoints as Point2D[][]);
            onSetPolygons(pointsToPolygons(newPolygonPoints as Point2D[][]));
          }
        }}
        dataValidator={polygonPointsValidator}
      >
        <Button
          className={styles.button}
          small
          tooltip="Copy Polygons"
          onClick={() => {
            void clipboard.copy(getFormattedString(polygonPoints));
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
    </div>
  );
}
