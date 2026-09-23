// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { UserProfile } from "@lichtblick/suite-base/context/UserProfileStorageContext";
import { IRemoteUserProfileStorage } from "@lichtblick/suite-base/services/IRemoteUserProfileStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";

export class UserProfileAPI implements IRemoteUserProfileStorage {
  private readonly path: string = "profile/lichtblick";

  public async getUserProfile(): Promise<UserProfile> {
    const { data } = await HttpService.get<{ profile: UserProfile }>(this.path);
    return data.profile;
  }

  public async setUserProfile(profile: UserProfile): Promise<void> {
    await HttpService.put(this.path, { profile });
  }
}
