// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { IRemoteFavoriteLayoutsStorage } from "@lichtblick/suite-base/services/IRemoteFavoriteLayoutsStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";

export class FavoriteLayoutsAPI implements IRemoteFavoriteLayoutsStorage {
  private readonly path: string = "profile";

  public async getFavoriteLayoutIds(): Promise<LayoutID[]> {
    const { data } = await HttpService.get<{ favoriteLayouts: string[] }>(
      `${this.path}/favorite-layouts`,
    );
    return data.favoriteLayouts as LayoutID[];
  }

  public async addFavoriteLayout(id: LayoutID): Promise<void> {
    await HttpService.post(`${this.path}/layout`, { layoutId: id });
  }

  public async removeFavoriteLayout(id: LayoutID): Promise<void> {
    await HttpService.delete(`${this.path}/${encodeURIComponent(id)}/layout`);
  }
}
