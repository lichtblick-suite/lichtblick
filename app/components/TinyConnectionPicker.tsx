// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import ChartDonut from "@mdi/svg/svg/chart-donut.svg";
import DatabaseIcon from "@mdi/svg/svg/database.svg";
import FileIcon from "@mdi/svg/svg/file.svg";
import TransitConnectionIcon from "@mdi/svg/svg/transit-connection-variant.svg";
import WanIcon from "@mdi/svg/svg/wan.svg";
import { ReactElement, useCallback, useState } from "react";

import RosSvg from "@foxglove-studio/app/assets/ros.svg";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";
import {
  PlayerSourceDefinition,
  usePlayerSelection,
} from "@foxglove-studio/app/context/PlayerSelectionContext";

type TinyConnectionPickerProps = {
  defaultIsOpen?: boolean;
};

export default function TinyConnectionPicker({
  defaultIsOpen = false,
}: TinyConnectionPickerProps): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(defaultIsOpen);
  const { selectSource, availableSources } = usePlayerSelection();

  const selectItem = useCallback(
    (item: PlayerSourceDefinition) => {
      setIsOpen(false);
      selectSource(item);
    },
    [selectSource],
  );

  return (
    <ChildToggle
      position="below"
      isOpen={isOpen}
      onToggle={setIsOpen}
      dataTest="open-connection-picker"
    >
      <WrappedIcon medium fade active={isOpen} style={{ marginRight: "10px" }}>
        <DatabaseIcon />
      </WrappedIcon>
      <Menu>
        {availableSources.map((item) => {
          let icon = <ChartDonut />;

          switch (item.type) {
            case "file":
              icon = <FileIcon />;
              break;
            case "ros1-core":
              icon = <RosSvg />;
              break;
            case "ws":
              icon = <TransitConnectionIcon />;
              break;
            case "http":
              icon = <WanIcon />;
              break;
          }
          return (
            <Item key={item.name} icon={icon} onClick={() => selectItem(item)}>
              {item.name}
            </Item>
          );
        })}
      </Menu>
    </ChildToggle>
  );
}
