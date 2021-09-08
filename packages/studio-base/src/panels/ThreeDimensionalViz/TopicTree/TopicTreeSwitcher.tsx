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

import LayersIcon from "@mdi/svg/svg/layers.svg";
import PinIcon from "@mdi/svg/svg/pin.svg";
import { useCallback } from "react";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import KeyboardShortcut from "@foxglove/studio-base/components/KeyboardShortcut";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { Save3DConfig } from "../index";

export const SWITCHER_HEIGHT = 30;
const STopicTreeSwitcher = styled.div`
  width: 28px;
  display: flex;
  height: ${SWITCHER_HEIGHT}px;
  position: relative;

  // We have to re-enable pointer-events here because they are disabled in STopicTreeWrapper
  pointer-events: auto;
`;

const SErrorsBadge = styled.div`
  position: absolute;
  top: -4px;
  left: 24px;
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background-color: ${colors.RED};
`;

/* TODO(Audrey): stay consistent with other buttons in the 3D panel, will consolidate later. */
const SIconWrapper = styled.div`
  width: 28px;
  border-radius: 4px;
  padding: 4px;
  position: absolute;
  top: 0;
  left: 0;
`;

type Props = {
  pinTopics: boolean;
  renderTopicTree: boolean;
  saveConfig: Save3DConfig;
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
    <STopicTreeSwitcher>
      <SIconWrapper
        style={{
          backgroundColor: "#2d2c33",
          opacity: renderTopicTree ? 0 : 1,
          transition: `all 0.15s ease-out ${renderTopicTree ? 0 : 0.2}s`,
        }}
      >
        <Icon
          tooltipProps={{ placement: "top", contents: <KeyboardShortcut keys={["T"]} /> }}
          dataTest="open-topic-picker"
          active={renderTopicTree}
          fade
          size="medium"
          onClick={onClick}
        >
          <LayersIcon />
        </Icon>
      </SIconWrapper>
      <SIconWrapper
        style={{
          transform: `translate(0px,${renderTopicTree ? 0 : -28}px)`,
          opacity: renderTopicTree ? 1 : 0,
          transition: `all 0.25s ease-in-out`,
          pointerEvents: renderTopicTree ? "unset" : "none",
        }}
      >
        <Icon
          tooltipProps={{ placement: "top", contents: "Pin topic picker" }}
          size="small"
          fade
          active={pinTopics}
          onClick={() => {
            // Keep TopicTree open after unpin.
            setShowTopicTree(true);
            saveConfig({ pinTopics: !pinTopics });
          }}
          style={{ color: pinTopics ? colors.HIGHLIGHT : colors.LIGHT }}
        >
          <PinIcon />
        </Icon>
      </SIconWrapper>
      {showErrorBadge && (
        <Tooltip contents="Errors found in selected topics/namespaces" placement="top">
          <SErrorsBadge />
        </Tooltip>
      )}
    </STopicTreeSwitcher>
  );
}
