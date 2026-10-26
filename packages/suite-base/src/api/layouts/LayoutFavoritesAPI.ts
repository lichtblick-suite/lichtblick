// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FavoriteLayoutsResponse } from "@lichtblick/suite-base/api/layouts/types";
import { IRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/services/IRemoteLayoutFavoritesStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";

export class LayoutFavoritesAPI implements IRemoteLayoutFavoritesStorage {
  public readonly favoriteLayoutsPath: string = "profile/favorite-layouts";

  public async getFavoriteLayoutIds(): Promise<string[]> {
    const { data } = await HttpService.get<FavoriteLayoutsResponse>(this.favoriteLayoutsPath);
    return data.favoriteLayouts;
  }

  public async addFavoriteLayout(externalId: string): Promise<void> {
    await HttpService.put<void>(this.#layoutPath(externalId));
  }

  public async removeFavoriteLayout(externalId: string): Promise<void> {
    await HttpService.delete<void>(this.#layoutPath(externalId));
  }

  #layoutPath(externalId: string): string {
    return `${this.favoriteLayoutsPath}/${encodeURIComponent(externalId)}`;
  }
}
