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

import { makeStyles } from "@fluentui/react";
import { useContext, useRef } from "react";

import { WorldviewReactContext, WorldviewContextType } from "@foxglove/regl-worldview";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

type Stats = {
  bufferCount: number;
  elementsCount: number;
  textureCount: number;
  shaderCount: number;

  getTotalTextureSize(): number;
  getTotalBufferSize(): number;
};

const useStyles = makeStyles((theme) => ({
  root: {
    position: "absolute",
    bottom: theme.spacing.m,
    right: theme.spacing.m,
    backgroundColor: theme.palette.neutralLight,
    borderRadius: theme.effects.roundedCorner2,
    fontFamily: fonts.MONOSPACE,
    fontSize: theme.fonts.tiny.fontSize,
    padding: theme.spacing.s2,
    pointerEvents: "none",

    td: {
      padding: 2,
      textAlign: "right",
    },
    th: {
      padding: "2px 6px",
      color: theme.semanticColors.menuHeader,
      textTransform: "uppercase",
    },
  },
}));

// Looks at the regl stats and throws errors if it seems we're going over acceptable (arbitrary) max ranges.
// The maxes are arbitrarily set to be an order of magnitude higher than the 'steady state' of a pretty loaded
// Foxglove Studio scene to allow for plenty of headroom.
function validate(stats: Stats) {
  if (stats.bufferCount > 500) {
    throw new Error(`Possible gl buffer leak detected. Buffer count: ${stats.bufferCount}`);
  }
  if (stats.elementsCount > 500) {
    throw new Error(`Possible gl elements leak detected. Buffer count: ${stats.elementsCount}`);
  }
  if (stats.textureCount > 500) {
    throw new Error(`Possible gl texture leak detected. Texture count: ${stats.textureCount}`);
  }
  // We should likely have far fewer than 100 shaders...they only get created when regl "compiles" a command.
  // Nevertheless, we should check in case there's some wild code somewhere constantly recompiling a command.
  if (stats.shaderCount > 100) {
    throw new Error(`Possible gl shader leak detected. Shader count: ${stats.shaderCount}`);
  }
}

// Shows debug regl stats in the 3d panel.  Crashes the panel if regl stats drift outside of acceptable ranges.
// TODO(bmc): move to regl-worldview at some point
export default function DebugStats(): JSX.Element | ReactNull {
  const classes = useStyles();
  const context = useContext<WorldviewContextType>(WorldviewReactContext);
  const renderCount = useRef(0);
  renderCount.current = renderCount.current + 1;
  if (context.initializedData.regl != undefined) {
    const { stats } = context.initializedData.regl as { stats: Stats };

    validate(stats);

    const textureSize = (stats.getTotalTextureSize() / (1024 * 1024)).toFixed(1);
    const bufferSize = (stats.getTotalBufferSize() / (1024 * 1024)).toFixed(1);

    return (
      <div className={classes.root}>
        <table>
          <tbody>
            <tr>
              <th>renders:</th>
              <td>{renderCount.current}</td>
            </tr>
            <tr>
              <th>buffers:</th>
              <td>{`${stats.bufferCount} (${bufferSize}) MB`}</td>
            </tr>
            <tr>
              <th>textures:</th>
              <td>{`${stats.textureCount} (${textureSize}) MB`}</td>
            </tr>
            <tr>
              <th>elements:</th>
              <td> {stats.elementsCount}</td>
            </tr>
            <tr>
              <th>shaders:</th>
              <td> {stats.shaderCount}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  return ReactNull;
}
