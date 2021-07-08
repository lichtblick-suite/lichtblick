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

import {
  RandomAccessDataProvider,
  RandomAccessDataProviderConstructor,
  RandomAccessDataProviderDescriptor,
  GetDataProvider,
} from "@foxglove/studio-base/randomAccessDataProviders/types";

export default function createGetDataProvider(descriptorMap: {
  [name: string]: RandomAccessDataProviderConstructor;
}): GetDataProvider {
  return function getDataProvider(
    descriptor: RandomAccessDataProviderDescriptor,
  ): RandomAccessDataProvider {
    const Provider = descriptorMap[descriptor.name];
    if (!Provider) {
      throw new Error(`Unknown RandomAccessDataProviderDescriptor#name: ${descriptor.name}`);
    }
    return new Provider(descriptor.args, descriptor.children, getDataProvider);
  };
}
