// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import ApiCheckerDataProvider, {
  instrumentTreeWithApiCheckerDataProvider,
} from "@foxglove-studio/app/dataProviders/ApiCheckerDataProvider";
import BagDataProvider from "@foxglove-studio/app/dataProviders/BagDataProvider";
import CombinedDataProvider from "@foxglove-studio/app/dataProviders/CombinedDataProvider";
import IdbCacheReaderDataProvider from "@foxglove-studio/app/dataProviders/IdbCacheReaderDataProvider";
import MeasureDataProvider, {
  instrumentTreeWithMeasureDataProvider,
} from "@foxglove-studio/app/dataProviders/MeasureDataProvider";
import MemoryCacheDataProvider from "@foxglove-studio/app/dataProviders/MemoryCacheDataProvider";
import ParseMessagesDataProvider from "@foxglove-studio/app/dataProviders/ParseMessagesDataProvider";
import RenameDataProvider from "@foxglove-studio/app/dataProviders/RenameDataProvider";
import WorkerDataProvider from "@foxglove-studio/app/dataProviders/WorkerDataProvider";
import createGetDataProvider from "@foxglove-studio/app/dataProviders/createGetDataProvider";
import { DataProviderDescriptor, DataProvider } from "@foxglove-studio/app/dataProviders/types";
import { MEASURE_DATA_PROVIDERS_QUERY_KEY } from "@foxglove-studio/app/util/globalConstants";

const getDataProviderBase = createGetDataProvider({
  ApiCheckerDataProvider,
  BagDataProvider,
  CombinedDataProvider,
  IdbCacheReaderDataProvider,
  MeasureDataProvider,
  MemoryCacheDataProvider,
  ParseMessagesDataProvider,
  RenameDataProvider,
  WorkerDataProvider,
});

export function rootGetDataProvider(tree: DataProviderDescriptor): DataProvider {
  if (new URLSearchParams(location.search).has(MEASURE_DATA_PROVIDERS_QUERY_KEY)) {
    tree = instrumentTreeWithMeasureDataProvider(tree);
  }
  return getDataProviderBase(instrumentTreeWithApiCheckerDataProvider(tree));
}
