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
import {
  ActionButton,
  Callout,
  IButton,
  IContextualMenuProps,
  keyframes,
  useTheme,
} from "@fluentui/react";
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import styled from "styled-components";

import helpContent from "@foxglove-studio/app/components/GlobalVariablesMenu/index.help.md";
import GlobalVariablesTable, {
  ANIMATION_RESET_DELAY_MS,
  isActiveElementEditable,
} from "@foxglove-studio/app/components/GlobalVariablesTable";
import Menu from "@foxglove-studio/app/components/Menu";
import HelpButton from "@foxglove-studio/app/components/PanelToolbar/HelpButton";
import useGlobalVariables from "@foxglove-studio/app/hooks/useGlobalVariables";
import inScreenshotTests from "@foxglove-studio/app/stories/inScreenshotTests";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

export const SLinkUnderline = styled.span`
  color: ${colors.BLUE};
  cursor: pointer;

  &:hover {
    color: ${colors.BLUE};
    text-decoration: underline;
  }
`;

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

type Props = {
  defaultIsOpen?: boolean; // Only for testing
  skipAnimation?: boolean; // Only for testing
};

function MenuContent(menuProps: IContextualMenuProps) {
  return (
    <Callout {...menuProps}>
      <Menu>
        <STitleBar>
          <STitle>Global variables</STitle>
          <SActions>
            <HelpButton iconStyle={{ width: "18px", height: "18px" }}>{helpContent}</HelpButton>
          </SActions>
        </STitleBar>
        <hr />
        <GlobalVariablesTable />
      </Menu>
    </Callout>
  );
}

function GlobalVariablesMenu(props: Props): React.ReactElement {
  const { defaultIsOpen = false, skipAnimation = inScreenshotTests() } = props;
  const [hasChangedVariable, setHasChangedVariable] = useState<boolean>(false);

  const {
    palette: { themePrimary },
  } = useTheme();
  const flashKeyframes = useMemo(
    () =>
      keyframes({
        "0%, 20%, 100%": { color: themePrimary },
        "10%, 30%, 80%": { color: colors.BLUE },
      }),
    [themePrimary],
  );

  const { globalVariables } = useGlobalVariables();
  useEffect(() => {
    setHasChangedVariable(!skipAnimation && !isActiveElementEditable());
    const timerId = setTimeout(() => setHasChangedVariable(false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [globalVariables, skipAnimation]);

  const buttonElementRef = useRef<HTMLElement>(ReactNull);
  const buttonRef = useRef<IButton>(ReactNull);
  useLayoutEffect(() => {
    if (defaultIsOpen) {
      buttonRef.current?.openMenu();
    }
  }, [defaultIsOpen]);

  return (
    <ActionButton
      componentRef={buttonRef}
      elementRef={buttonElementRef}
      iconProps={{
        iconName: "Variable2",
        styles: {
          root: {
            "& span": { verticalAlign: "baseline" },
            animation: hasChangedVariable
              ? `${flashKeyframes} ${AnimationDuration}s ease-out forwards`
              : undefined,
          },
        },
      }}
      menuProps={{ items: [] }}
      onRenderMenuIcon={() => ReactNull}
      menuAs={MenuContent}
    />
  );
}

export default GlobalVariablesMenu;
