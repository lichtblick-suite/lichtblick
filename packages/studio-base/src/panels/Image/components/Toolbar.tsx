// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CursorIcon from "@mdi/svg/svg/cursor-default.svg";
import { Theme, Typography } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { ReactElement, useEffect, useRef, useState } from "react";
import Tree from "react-json-tree";

import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { PixelData } from "../types";

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    displauy: "flex",
    flexDirection: "column",
    position: "absolute",
    top: 0,
    right: 0,
    marginRight: theme.spacing(2),
    marginTop: theme.spacing(8),
    visibility: "hidden",
    zIndex: "drawer",
  },
  visible: {
    visibility: "visible",
  },
  objectPane: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  values: {
    display: "flex",
    color: theme.palette.info.main,
    gap: theme.spacing(1),
  },
}));

enum TabName {
  SELECTED_POINT = "Selected Point",
}

function ObjectPane({ pixelData }: { pixelData: PixelData | undefined }): ReactElement {
  const classes = useStyles();
  const jsonTreeTheme = useJsonTreeTheme();

  return (
    <div className={classes.objectPane}>
      <div>
        <Typography variant="caption">Position:</Typography>
        <div className={classes.values}>
          <div>X:{pixelData?.position.x}</div>
          <div>Y:{pixelData?.position.y}</div>
        </div>
      </div>
      <div>
        <Typography variant="caption">Color:</Typography>
        <div className={classes.values}>
          <div>R:{pixelData?.color.r}</div>
          <div>G:{pixelData?.color.g}</div>
          <div>B:{pixelData?.color.b}</div>
          <div>A:{pixelData?.color.a}</div>
        </div>
      </div>
      {pixelData?.marker && (
        <div>
          <Typography variant="caption">Marker:</Typography>
          <Tree
            data={pixelData.marker}
            hideRoot
            invertTheme={false}
            theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          />
        </div>
      )}
    </div>
  );
}

export function Toolbar({ pixelData }: { pixelData: PixelData | undefined }): JSX.Element {
  const classes = useStyles();
  const ref = useRef<HTMLDivElement>(ReactNull);
  const [selectedTab, setSelectedTab] = useState<TabName | undefined>();

  useEffect(() => {
    if (pixelData) {
      setSelectedTab(TabName.SELECTED_POINT);
    } else {
      setSelectedTab(undefined);
    }
  }, [pixelData]);

  const mousePresent = usePanelMousePresence(ref);

  return (
    <div
      ref={ref}
      className={cx(classes.root, {
        [classes.visible]: mousePresent,
      })}
    >
      <ExpandingToolbar
        tooltip="Inspect objects"
        icon={<CursorIcon />}
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
      >
        <ToolGroup name={TabName.SELECTED_POINT}>
          <ToolGroupFixedSizePane>
            {pixelData ? (
              <ObjectPane pixelData={pixelData} />
            ) : (
              <Typography color="secondary.main">Click an object to select it.</Typography>
            )}
          </ToolGroupFixedSizePane>
        </ToolGroup>
      </ExpandingToolbar>
    </div>
  );
}
