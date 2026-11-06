// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { Player } from "@lichtblick/suite-base/players/types";

import { CLOSE_DATA_SOURCE_FACTORY_ID } from "./constants";

/**
 * Hidden benchmark-only "data source" whose `initialize` never creates a player. Selecting it makes
 * `PlayerManager` replace the current player with none, which closes the current player through the
 * normal MessagePipeline teardown (`player.close()`), so the runner can capture the
 * `datasource.close` phase and the final pipeline counters without leaving the page.
 */
class CloseDataSourceFactory implements IDataSourceFactory {
  public id = CLOSE_DATA_SOURCE_FACTORY_ID;
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Close data source (benchmark)";
  public hidden = true;

  public initialize(_args: DataSourceFactoryInitializeArgs): Player | undefined {
    return undefined;
  }
}

export { CloseDataSourceFactory };
