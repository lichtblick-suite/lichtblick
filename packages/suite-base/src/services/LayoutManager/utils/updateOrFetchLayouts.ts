// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import {
  IRemoteLayoutStorage,
  RemoteLayout,
} from "@lichtblick/suite-base/services/IRemoteLayoutStorage";

const log = Logger.getLogger(__filename);

/**
 * Try to perform the given updateLayout operation on remote storage. If a conflict is returned,
 * fetch the most recent version of the layout and return that instead.
 */
export async function updateOrFetchLayout(
  remote: IRemoteLayoutStorage,
  params: Parameters<IRemoteLayoutStorage["updateLayout"]>[0],
): Promise<RemoteLayout> {
  const response = await remote.updateLayout(params);
  switch (response.status) {
    case "success":
      return response.newLayout;
    case "conflict": {
      const remoteLayout = await remote.getLayout(params.id);
      if (!remoteLayout) {
        throw new Error(`Update rejected but layout is not present on server: ${params.id}`);
      }
      log.info(`Layout update rejected, using server version: ${params.id}`);
      return remoteLayout;
    }
  }
}
