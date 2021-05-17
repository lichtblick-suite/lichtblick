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
} from "@foxglove/studio-base/dataProviders/ApiCheckerDataProvider";
import BagDataProvider from "@foxglove/studio-base/dataProviders/BagDataProvider";
import CombinedDataProvider from "@foxglove/studio-base/dataProviders/CombinedDataProvider";
import MemoryCacheDataProvider from "@foxglove/studio-base/dataProviders/MemoryCacheDataProvider";
import ParseMessagesDataProvider from "@foxglove/studio-base/dataProviders/ParseMessagesDataProvider";
import RenameDataProvider from "@foxglove/studio-base/dataProviders/RenameDataProvider";
import WorkerDataProvider from "@foxglove/studio-base/dataProviders/WorkerDataProvider";
import createGetDataProvider from "@foxglove/studio-base/dataProviders/createGetDataProvider";
import { DataProviderDescriptor, DataProvider } from "@foxglove/studio-base/dataProviders/types";

const getDataProviderBase = createGetDataProvider({
  ApiCheckerDataProvider,
  BagDataProvider,
  CombinedDataProvider,
  MemoryCacheDataProvider,
  ParseMessagesDataProvider,
  RenameDataProvider,
  WorkerDataProvider,
});

export function rootGetDataProvider(tree: DataProviderDescriptor): DataProvider {
  return getDataProviderBase(instrumentTreeWithApiCheckerDataProvider(tree));
}
