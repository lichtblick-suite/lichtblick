// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import LayersIcon from "@mui/icons-material/Layers";
import PushPinIcon from "@mui/icons-material/PushPin";
import { IconButton as MuiIconButton, styled as muiStyled } from "@mui/material";
import { useCallback } from "react";

import { Save3DConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz";

export const SWITCHER_HEIGHT = 30;

const BADGE_SIZE = 10;
const BADGE_RADIUS = BADGE_SIZE / 2;
const BADGE_OFFSET = 2;

const TopicTreeSwitcherRoot = muiStyled("div")({
  position: "relative",
  pointerEvents: "auto",
});

function shouldForwardProp(prop: string) {
  return prop !== "renderTopicTree" && prop !== "showErrorBadge";
}

const PinIconButton = muiStyled(MuiIconButton, { shouldForwardProp })<{ renderTopicTree: boolean }>(
  ({ theme, renderTopicTree }) => ({
    color: theme.palette.common.white,
    backgroundColor: "transparent",
    transition: "opacity 0.25s ease-in-out, transform 0.25s ease-in-out",
    transform: "translateY(-100%)",
    pointerEvents: "none",
    opacity: 0,

    ...(renderTopicTree && {
      transform: "translateY(0%)",
      pointerEvents: "auto",
      opacity: 1,
    }),
  }),
);

const LayersIconButton = muiStyled(MuiIconButton, { shouldForwardProp })<{
  renderTopicTree: boolean;
  showErrorBadge: boolean;
}>(({ renderTopicTree, showErrorBadge, theme }) => ({
  position: "relative",
  transform: "translateX(-100%)",
  backgroundColor: theme.palette.background.paper,
  opacity: 1,
  transition: `opacity 0.15s ease-out 0.2s`,
  pointerEvents: "auto",

  "&:hover": {
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
  },
  ...(renderTopicTree && {
    opacity: 0,
    transition: `opacity 0.15s ease-out 0s`,
    pointerEvents: "none",
  }),
  ...(showErrorBadge && {
    "&:before": {
      content: '""',
      position: "absolute",
      top: -BADGE_RADIUS + BADGE_OFFSET,
      right: -BADGE_RADIUS + BADGE_OFFSET,
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      borderRadius: BADGE_RADIUS,
      backgroundColor: theme.palette.error.main,
      zIndex: 101,
    },
  }),
}));

type Props = {
  pinTopics: boolean;
  renderTopicTree: boolean;
  saveConfig: Save3DConfig;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setShowTopicTree: (arg0: boolean | ((arg0: boolean) => boolean)) => void;
  showErrorBadge: boolean;
};

export default function TopicTreeSwitcher({
  pinTopics,
  renderTopicTree,
  saveConfig,
  setShowTopicTree,
  showErrorBadge,
}: Props): JSX.Element {
  const onClick = useCallback(() => setShowTopicTree((shown) => !shown), [setShowTopicTree]);

  return (
    <TopicTreeSwitcherRoot>
      <PinIconButton
        title="Pin topic picker"
        onClick={() => {
          // Keep TopicTree open after unpin.
          setShowTopicTree(true);
          saveConfig({ pinTopics: !pinTopics });
        }}
        renderTopicTree={renderTopicTree}
        data-testid="open-topic-picker"
      >
        <PushPinIcon fontSize="small" color={pinTopics ? "info" : "inherit"} />
      </PinIconButton>

      <LayersIconButton
        showErrorBadge={showErrorBadge}
        renderTopicTree={renderTopicTree}
        onClick={onClick}
        title={
          showErrorBadge ? "Errors found in selected topics/namespaces" : "Open topic switcher"
        }
      >
        <LayersIcon fontSize="small" />
      </LayersIconButton>
    </TopicTreeSwitcherRoot>
  );
}
