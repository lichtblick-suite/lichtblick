// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import EarthIcon from "@mdi/svg/svg/earth.svg";
import { useState, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled, { css } from "styled-components";

import { AddPanelPayload, addPanel } from "@foxglove-studio/app/actions/panels";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Flex from "@foxglove-studio/app/components/Flex";
import GlobalVariablesTable, {
  ANIMATION_RESET_DELAY_MS,
  isActiveElementEditable,
  makeFlashAnimation,
} from "@foxglove-studio/app/components/GlobalVariablesTable";
import { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import Menu from "@foxglove-studio/app/components/Menu";
import HelpButton from "@foxglove-studio/app/components/PanelToolbar/HelpButton";
import useGlobalVariables from "@foxglove-studio/app/hooks/useGlobalVariables";
import GlobalVariables from "@foxglove-studio/app/panels/GlobalVariables";
import helpContent from "@foxglove-studio/app/panels/GlobalVariables/index.help.md";
import { SLinkUnderline } from "@foxglove-studio/app/shared/styledComponents";
import inScreenshotTests from "@foxglove-studio/app/stories/inScreenshotTests";
import logEvent, { getEventTags, getEventNames } from "@foxglove-studio/app/util/logEvent";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

const STitleBar = styled.div`
  display: flex;
  padding: 16px;
  align-items: center;
`;

const STitle = styled.div`
  flex: 1 1;
  font-size: 14px;
`;

const SActions = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: center;

  > * {
    margin-left: 8px;
  }
`;

const AnimationDuration = 3;
const IconFlashKeyframes = makeFlashAnimation(
  css`
    opacity: 0.5;
    color: ${colors.LIGHT};
  `,
  css`
    opacity: 1;
    color: ${colors.BLUE};
  `,
);
const IconFlashAnimation = css`
  animation: ${IconFlashKeyframes} ${AnimationDuration}s ease-out;
  animation-fill-mode: forwards;
`;

const SAnimatedIcon = styled(WrappedIcon)`
  color: ${colors.LIGHT};
  transition: all ${AnimationDuration}s;
  ${({ animate, skipAnimation }: any) => (animate && !skipAnimation ? IconFlashAnimation : "none")};
`;

type Props = {
  defaultIsOpen?: boolean; // Only for testing
  skipAnimation?: boolean; // Only for testing
};

function GlobalVariablesMenu(props: Props) {
  const { defaultIsOpen, skipAnimation = inScreenshotTests() } = props;
  const [hasChangedVariable, setHasChangedVariable] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(defaultIsOpen || false);
  const onToggle = useCallback((newValue: boolean) => {
    setHasChangedVariable(false);
    setIsOpen(newValue);
  }, []);

  const dispatch = useDispatch();
  const layout = useSelector((state: any) => state.persistedState.panels.layout);
  const addPanelToLayout = useCallback(() => {
    setIsOpen(false);
    dispatch(addPanel({ type: GlobalVariables.panelType, layout } as AddPanelPayload));

    logEvent({
      name: getEventNames().PANEL_ADD,
      tags: { [getEventTags().PANEL_TYPE]: GlobalVariables.panelType },
    });
  }, [dispatch, layout]);

  const { globalVariables } = useGlobalVariables();
  useEffect(() => {
    setHasChangedVariable(!skipAnimation && !isActiveElementEditable());
    const timerId = setTimeout(() => setHasChangedVariable(false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [globalVariables, skipAnimation]);

  return (
    <ChildToggle
      position="below"
      isOpen={isOpen}
      onToggle={onToggle}
      dataTest="open-global-variables"
    >
      <Flex center>
        <SAnimatedIcon
          medium
          fade
          active={isOpen}
          // @ts-expect-error resolve once type for SAnimatedIcon props is specified
          animate={hasChangedVariable}
          skipAnimation={skipAnimation || isOpen}
          style={{ transition: "all 1s ease-out" }}
          tooltip="Global variables"
        >
          <EarthIcon />
        </SAnimatedIcon>
      </Flex>
      <Menu>
        <STitleBar>
          <STitle>Global variables</STitle>
          <SActions>
            <SLinkUnderline onClick={addPanelToLayout}>Add panel to layout</SLinkUnderline>
            <HelpButton iconStyle={{ width: "18px", height: "18px" }}>{helpContent}</HelpButton>
          </SActions>
        </STitleBar>
        <hr />
        <GlobalVariablesTable />
      </Menu>
    </ChildToggle>
  );
}

export default GlobalVariablesMenu;
