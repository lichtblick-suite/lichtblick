// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";

import PathSettingsModal from "./PathSettingsModal";
import { PlotPath } from "./internalTypes";

export default {
  title: "panels/Plot/PathSettingsModal",
  component: PathSettingsModal,
  parameters: { colorScheme: "light" },
};

export function DefaultIndex0(): JSX.Element {
  const paths: PlotPath[] = [
    { enabled: true, timestampMethod: "receiveTime", value: "/some.path" },
  ];
  const index = 0;
  return (
    <PathSettingsModal
      xAxisVal="timestamp"
      path={paths[index]!}
      paths={paths}
      index={index}
      onDismiss={action("onDismiss")}
      savePaths={action("savePaths")}
    />
  );
}

export function DefaultIndex1(): JSX.Element {
  const paths: PlotPath[] = [
    { enabled: true, timestampMethod: "receiveTime", value: "/some.path" },
    { enabled: true, timestampMethod: "receiveTime", value: "/some.other.path" },
  ];
  const index = 1;
  return (
    <PathSettingsModal
      xAxisVal="timestamp"
      path={paths[index]!}
      paths={paths}
      index={index}
      onDismiss={action("onDismiss")}
      savePaths={action("savePaths")}
    />
  );
}

export function CustomColor(): JSX.Element {
  const paths: PlotPath[] = [
    { enabled: true, timestampMethod: "receiveTime", value: "/some.path" },
    { enabled: true, timestampMethod: "receiveTime", value: "/some.other.path", color: "#ff0000" },
  ];
  const index = 1;
  return (
    <PathSettingsModal
      xAxisVal="timestamp"
      path={paths[index]!}
      paths={paths}
      index={index}
      onDismiss={action("onDismiss")}
      savePaths={action("savePaths")}
    />
  );
}

export function CustomXAxis(): JSX.Element {
  const paths: PlotPath[] = [
    { enabled: true, timestampMethod: "receiveTime", value: "/some.path" },
  ];
  const index = 0;
  return (
    <PathSettingsModal
      xAxisVal="custom"
      path={paths[index]!}
      paths={paths}
      index={index}
      onDismiss={action("onDismiss")}
      savePaths={action("savePaths")}
    />
  );
}

export function ReferenceLine(): JSX.Element {
  const paths: PlotPath[] = [{ enabled: true, timestampMethod: "receiveTime", value: "42" }];
  const index = 0;
  return (
    <PathSettingsModal
      xAxisVal="timestamp"
      path={paths[index]!}
      paths={paths}
      index={index}
      onDismiss={action("onDismiss")}
      savePaths={action("savePaths")}
    />
  );
}
