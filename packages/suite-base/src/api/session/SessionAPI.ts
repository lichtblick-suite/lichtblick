// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";

import { SessionMcap, SessionResponse } from "./types";

export class SessionAPI {
  public readonly sessionPath = "session";
  public async getSession(sessionId: string, signal?: AbortSignal): Promise<SessionMcap[]> {
    const { data } = await HttpService.get<SessionResponse>(
      `${this.sessionPath}/${sessionId}`,
      {},
      {
        signal,
      },
    );
    return data.mcaps;
  }
}

export default new SessionAPI();
