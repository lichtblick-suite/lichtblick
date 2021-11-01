// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, Text } from "@fluentui/react";

import { IDataSourceFactory } from "@foxglove/studio-base";

export default class VelodyneUnavailableDataSourceFactory implements IDataSourceFactory {
  id = "velodyne-device";
  displayName = "Velodyne LIDAR";
  iconName: IDataSourceFactory["iconName"] = "GenericScan";

  disabledReason = (
    <>
      <Text block as="p">
        Velodyne connections are only available in our desktop app.&nbsp;
        <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
          Download it here.
        </Link>
      </Text>
      <Text
        block
        as="p"
        styles={(_props, theme) => ({ root: { color: theme.semanticColors.disabledText } })}
      >
        Native TCP and UDP sockets are not available in a standard browser environment.
      </Text>
    </>
  );

  initialize(): ReturnType<IDataSourceFactory["initialize"]> {
    return;
  }
}
