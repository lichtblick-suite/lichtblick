// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Cursor24Regular } from "@fluentui/react-icons";
import { Typography } from "@mui/material";
import { ReactElement, useEffect, useRef, useState } from "react";
import Tree from "react-json-tree";
import { makeStyles } from "tss-react/mui";

import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { PixelData } from "../types";

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    position: "absolute",
    top: 0,
    right: 0,
    margin: theme.spacing(0.75),
    zIndex: theme.zIndex.tooltip,
  },
  hidden: {
    visibility: "hidden",
  },
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
  const { classes, cx } = useStyles();
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
        [classes.hidden]: !mousePresent,
      })}
    >
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
    </div>
  );
}
