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

import { ActionButton, Callout, IButton, IContextualMenuProps } from "@fluentui/react";
import { useCallback, useRef, useLayoutEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addPanel, AddPanelPayload } from "@foxglove-studio/app/actions/panels";
import Menu from "@foxglove-studio/app/components/Menu";
import PanelList, { PanelSelection } from "@foxglove-studio/app/components/PanelList";
import { State as ReduxState } from "@foxglove-studio/app/reducers";
import logEvent, { getEventNames, getEventTags } from "@foxglove-studio/app/util/logEvent";

type Props = {
  defaultIsOpen?: boolean; // just for testing
};

function MenuContent(menuProps: IContextualMenuProps) {
  const dispatch = useDispatch();
  const layout = useSelector((state: ReduxState) => state.persistedState.panels.layout);
  const onPanelSelect = useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      dispatch(addPanel({ type, layout, config, relatedConfigs } as AddPanelPayload));

      const name = getEventNames().PANEL_ADD;
      const panelType = getEventTags().PANEL_TYPE;
      if (name != undefined && panelType != undefined) {
        logEvent({ name: name, tags: { [panelType]: type } });
      }
    },
    [dispatch, layout],
  );
  return (
    <Callout
      {...menuProps}
      directionalHintFixed
      layerProps={{
        // Allow dragging panels from the menu into the layout
        eventBubblingEnabled: true,
      }}
    >
      <Menu>
        <PanelList onPanelSelect={onPanelSelect} />
      </Menu>
    </Callout>
  );
}

function AddPanelMenu({ defaultIsOpen = false }: Props): React.ReactElement {
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
        iconName: "CirclePlus",
        styles: { root: { "& span": { verticalAlign: "baseline" } } },
      }}
      menuProps={{ items: [] }}
      onRenderMenuIcon={() => ReactNull}
      menuAs={MenuContent}
    />
  );
}

export default AddPanelMenu;
