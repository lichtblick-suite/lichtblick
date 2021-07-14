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

import { ActionButton, IButton } from "@fluentui/react";
import { ReactElement, useLayoutEffect, useRef } from "react";

import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";

type TinyConnectionPickerProps = {
  defaultIsOpen?: boolean;
};

export default function TinyConnectionPicker({
  defaultIsOpen = false,
}: TinyConnectionPickerProps): ReactElement {
  const { selectSource, availableSources } = usePlayerSelection();

  const buttonRef = useRef<IButton>(ReactNull);
  useLayoutEffect(() => {
    if (defaultIsOpen) {
      buttonRef.current?.openMenu();
    }
  }, [defaultIsOpen]);

  return (
    <ActionButton
      componentRef={buttonRef}
      data-test="open-connection-picker"
      iconProps={{
        iconName: "DataManagementSettings",
        styles: { root: { "& span": { verticalAlign: "baseline" } } },
      }}
      onRenderMenuIcon={() => ReactNull}
      menuProps={{
        items: availableSources.map((source) => {
          let iconName: RegisteredIconNames;
          switch (source.type) {
            case "ros1-local-bagfile":
              iconName = "OpenFile";
              break;
            case "ros2-folder":
              iconName = "OpenFolder";
              break;
            case "ros1-socket":
              iconName = "studio.ROS";
              break;
            case "ros-ws":
              iconName = "Flow";
              break;
            case "ros1-remote-bagfile":
              iconName = "FileASPX";
              break;
            case "velodyne-device":
              iconName = "GenericScan";
              break;
          }
          return {
            key: source.name,
            text: source.name,
            onClick: () => selectSource(source),
            iconProps: { iconName },
          };
        }),
      }}
    />
  );
}
