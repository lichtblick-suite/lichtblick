// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box, Stack, Typography } from "@mui/material";
import { ReactElement, useEffect, useRef, useState } from "react";
import Tree from "react-json-tree";

import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { PixelData } from "./types";

const style = {
  values: {
    color: colors.HIGHLIGHT,
  },
};

enum TabName {
  SELECTED_POINT = "Selected Point",
}

export function ObjectPane({ pixelData }: { pixelData: PixelData | undefined }): ReactElement {
  const jsonTreeTheme = useJsonTreeTheme();

  return (
    <Stack spacing={1}>
      <Box>
        <Typography variant="caption">Position:</Typography>
        <Stack direction="row" spacing={1} sx={style.values}>
          <Box>X:{pixelData?.position.x}</Box>
          <Box>Y:{pixelData?.position.y}</Box>
        </Stack>
      </Box>
      <Box>
        <Typography variant="caption">Color:</Typography>
        <Stack direction="row" spacing={1} sx={style.values}>
          <Box>R:{pixelData?.color.r}</Box>
          <Box>G:{pixelData?.color.g}</Box>
          <Box>B:{pixelData?.color.b}</Box>
          <Box>A:{pixelData?.color.a}</Box>
        </Stack>
      </Box>
      {pixelData?.marker && (
        <Box>
          <Typography variant="caption">Marker:</Typography>
          <Tree
            data={pixelData.marker}
            hideRoot
            invertTheme={false}
            theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          />
        </Box>
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
    }
  }, [pixelData]);

  const mousePresent = usePanelMousePresence(ref);

  return (
    <Stack
      ref={ref}
      sx={{
        position: "absolute",
        top: 0,
        right: 0,
        mr: 2,
        mt: 8,
        visibility: mousePresent ? "visible" : "hidden",
        zIndex: "drawer",
      }}
    >
      <ExpandingToolbar
        tooltip="Inspect objects"
        iconName="CursorDefault"
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
      >
        <ToolGroup name={TabName.SELECTED_POINT}>
          <ToolGroupFixedSizePane>
            {pixelData && <ObjectPane pixelData={pixelData} />}
            {!pixelData && (
              <Box sx={{ color: "secondary.dark" }}>Click an object to select it.</Box>
            )}
          </ToolGroupFixedSizePane>
        </ToolGroup>
      </ExpandingToolbar>
    </Stack>
  );
}
