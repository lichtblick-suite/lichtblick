// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Cursor24Regular } from "@fluentui/react-icons";
import { Typography, styled as muiStyled } from "@mui/material";
import { ReactElement, useEffect, useRef, useState } from "react";
import Tree from "react-json-tree";

import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { PixelData } from "../types";

const ToolbarRoot = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "visible",
})<{
  visible: boolean;
}>(({ visible, theme }) => ({
  displauy: "flex",
  flexDirection: "column",
  position: "absolute",
  top: 0,
  right: 0,
  marginRight: theme.spacing(0.75),
  marginTop: `calc(${theme.spacing(0.75)} + ${PANEL_TOOLBAR_MIN_HEIGHT}px)`,
  zIndex: theme.zIndex.tooltip,
  visibility: visible ? "visible" : "hidden",
}));

enum TabName {
  SELECTED_POINT = "Selected Point",
}

function ObjectPane({ pixelData }: { pixelData: PixelData | undefined }): ReactElement {
  const jsonTreeTheme = useJsonTreeTheme();

  return (
    <Stack gap={1}>
      <div>
        <Typography variant="caption">Position:</Typography>
        <Stack direction="row" gap={1}>
          <Typography color="info.main" variant="body2">
            X:{pixelData?.position.x}
          </Typography>
          <Typography color="info.main" variant="body2">
            Y:{pixelData?.position.y}
          </Typography>
        </Stack>
      </div>
      <div>
        <Typography variant="caption">Color:</Typography>
        <Stack direction="row" gap={1}>
          <Typography color="info.main" variant="body2">
            R:{pixelData?.color.r}
          </Typography>
          <Typography color="info.main" variant="body2">
            G:{pixelData?.color.g}
          </Typography>
          <Typography color="info.main" variant="body2">
            B:{pixelData?.color.b}
          </Typography>
          <Typography color="info.main" variant="body2">
            A:{pixelData?.color.a}
          </Typography>
        </Stack>
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
    </Stack>
  );
}

export function Toolbar({ pixelData }: { pixelData: PixelData | undefined }): JSX.Element {
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
    <ToolbarRoot ref={ref} visible={mousePresent}>
      <ExpandingToolbar
        tooltip="Inspect objects"
        icon={<Cursor24Regular />}
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
    </ToolbarRoot>
  );
}
