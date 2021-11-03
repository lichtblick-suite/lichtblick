// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, makeStyles, useTheme } from "@fluentui/react";
import cx from "classnames";
import { useCallback } from "react";

import KeyboardShortcut from "@foxglove/studio-base/components/KeyboardShortcut";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { Save3DConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export const SWITCHER_HEIGHT = 30;

const BADGE_SIZE = 10;
const BADGE_RADIUS = BADGE_SIZE / 2;
const BADGE_OFFSET = 2;

const useStyles = makeStyles((theme) => ({
  root: {
    position: "relative",
    pointerEvents: "auto",
  },
  badge: {
    ":before": {
      content: '""',
      position: "absolute",
      top: -BADGE_RADIUS + BADGE_OFFSET,
      right: -BADGE_RADIUS + BADGE_OFFSET,
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      borderRadius: BADGE_RADIUS,
      backgroundColor: theme.semanticColors.errorBackground,
      zIndex: 101,
    },
  },
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
  const theme = useTheme();
  const classes = useStyles();
  const onClick = useCallback(() => setShowTopicTree((shown) => !shown), [setShowTopicTree]);

  const pinButton = useTooltip({ placement: "top", contents: "Pin topic picker" });
  const topicButton = useTooltip({
    placement: "top",
    contents: showErrorBadge ? (
      "Errors found in selected topics/namespaces"
    ) : (
      <KeyboardShortcut keys={["T"]} />
    ),
  });

  return (
    <div className={classes.root}>
      {renderTopicTree ? pinButton.tooltip : topicButton.tooltip}
      <IconButton
        elementRef={pinButton.ref}
        onClick={() => {
          // Keep TopicTree open after unpin.
          setShowTopicTree(true);
          saveConfig({ pinTopics: !pinTopics });
        }}
        data-test="open-topic-picker"
        iconProps={{ iconName: "Pin" }}
        checked={pinTopics}
        styles={{
          root: {
            transform: `translateY(${renderTopicTree ? 0 : -100}%)`,
            backgroundColor: "transparent",
            opacity: renderTopicTree ? 1 : 0,
            transition: "opacity 0.25s ease-in-out, transform 0.25s ease-in-out",
            pointerEvents: renderTopicTree ? "auto" : "none",
          },
          rootHovered: { backgroundColor: "transparent" },
          rootPressed: { backgroundColor: "transparent" },
          rootDisabled: { backgroundColor: "transparent" },
          rootChecked: { backgroundColor: "transparent" },
          rootCheckedHovered: { backgroundColor: "transparent" },
          rootCheckedPressed: { backgroundColor: "transparent" },
          iconChecked: { color: colors.HIGHLIGHT },
          icon: {
            color: colors.LIGHT1,

            svg: {
              fill: "currentColor",
              height: "1em",
              width: "1em",
            },
          },
        }}
      />
      <IconButton
        className={cx({ [classes.badge]: showErrorBadge })}
        elementRef={topicButton.ref}
        onClick={onClick}
        iconProps={{ iconName: "Layers" }}
        styles={{
          root: {
            position: "relative",
            transform: "translateX(-100%)",
            backgroundColor: theme.semanticColors.buttonBackgroundHovered,
            opacity: renderTopicTree ? 0 : 1,
            transition: `opacity 0.15s ease-out ${renderTopicTree ? 0 : 0.2}s`,
            pointerEvents: renderTopicTree ? "none" : "auto",
          },
          rootHovered: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
          rootPressed: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
          rootDisabled: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
          iconChecked: { color: colors.ACCENT },
          icon: {
            color: theme.semanticColors.bodyText,

            svg: {
              fill: "currentColor",
              height: "1em",
              width: "1em",
            },
          },
        }}
      />
    </div>
  );
}
