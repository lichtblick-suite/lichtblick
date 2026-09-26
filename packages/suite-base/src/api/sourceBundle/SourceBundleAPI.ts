// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";

import { SourceBundleData, SourceBundleResponse } from "./types";

export class SourceBundleAPI {
  public readonly sourceBundlePath = "source-bundle";
  public async getSourceBundle(
    sourceBundleId: string,
    signal?: AbortSignal,
  ): Promise<SourceBundleData> {
    const { data } = await HttpService.get<SourceBundleResponse>(
      `${this.sourceBundlePath}/${sourceBundleId}`,
      {},
      {
        signal,
      },
    );
    return {
      mcaps: data.mcaps,
      additionalSources: data.additionalSources ?? [],
    };
  }
}

export default new SourceBundleAPI();
