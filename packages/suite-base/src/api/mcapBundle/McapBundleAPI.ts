// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";

import { McapBundleFile, McapBundleResponse } from "./types";

export class McapBundleAPI {
  public readonly mcapBundlePath = "mcap-bundle";
  public async getMcapBundle(
    mcapBundleId: string,
    signal?: AbortSignal,
  ): Promise<McapBundleFile[]> {
    const { data } = await HttpService.get<McapBundleResponse>(
      `${this.mcapBundlePath}/${mcapBundleId}`,
      {},
      {
        signal,
      },
    );
    return data.mcaps;
  }
}

export default new McapBundleAPI();
