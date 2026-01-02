// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";

export default class MockLayoutManager implements ILayoutManager {
  public supportsSharing = false;
  public isBusy = jest.fn().mockReturnValue(false);
  public isOnline = false;
  public error: Error | undefined = undefined;

  public on = jest.fn();
  public off = jest.fn();
  public setError = jest.fn();
  public setOnline = jest.fn();
  public getLayouts = jest.fn().mockResolvedValue([]);
  public getLayout = jest.fn();
  public saveNewLayout = jest.fn();
  public updateLayout = jest.fn();
  public deleteLayout = jest.fn();
  public overwriteLayout = jest.fn();
  public revertLayout = jest.fn();
  public makePersonalCopy = jest.fn();
  public syncWithRemote = jest.fn();
}
