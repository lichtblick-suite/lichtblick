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
} from "@foxglove/studio-base/randomAccessDataProviders/ApiCheckerDataProvider";
import BagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/BagDataProvider";
import MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import ParseMessagesDataProvider from "@foxglove/studio-base/randomAccessDataProviders/ParseMessagesDataProvider";
import Rosbag2DataProvider from "@foxglove/studio-base/randomAccessDataProviders/Rosbag2DataProvider";
import UlogDataProvider from "@foxglove/studio-base/randomAccessDataProviders/UlogDataProvider";
import WorkerDataProvider from "@foxglove/studio-base/randomAccessDataProviders/WorkerDataProvider";
import createGetDataProvider from "@foxglove/studio-base/randomAccessDataProviders/createGetDataProvider";
import {
  RandomAccessDataProviderDescriptor,
  RandomAccessDataProvider,
} from "@foxglove/studio-base/randomAccessDataProviders/types";

const getDataProviderBase = createGetDataProvider({
  ApiCheckerDataProvider,
  BagDataProvider,
  MemoryCacheDataProvider,
  ParseMessagesDataProvider,
  Rosbag2DataProvider,
  UlogDataProvider,
  WorkerDataProvider,
});

export function rootGetDataProvider(
  tree: RandomAccessDataProviderDescriptor,
): RandomAccessDataProvider {
  return getDataProviderBase(instrumentTreeWithApiCheckerDataProvider(tree));
}
