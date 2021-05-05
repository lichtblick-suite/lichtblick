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
import { useRef, useLayoutEffect } from "react";

import Menu from "@foxglove-studio/app/components/Menu";
import PanelList from "@foxglove-studio/app/components/PanelList";
import useSelectPanel from "@foxglove-studio/app/hooks/useSelectPanel";

type Props = {
  defaultIsOpen?: boolean; // just for testing
};

function MenuContent(menuProps: IContextualMenuProps) {
  const selectPanel = useSelectPanel();
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
        <PanelList onPanelSelect={selectPanel} />
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
