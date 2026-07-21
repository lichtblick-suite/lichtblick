// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";

export default class MockLayoutManager implements ILayoutManager {
  public supportsSharing = false;
  public isBusy = vi.fn().mockReturnValue(false);
  public isOnline = false;
  public error: Error | undefined = undefined;

  public on = vi.fn();
  public off = vi.fn();
  public setError = vi.fn();
  public setOnline = vi.fn();
  public getLayouts = vi.fn().mockResolvedValue([]);
  public getLayout = vi.fn();
  public saveNewLayout = vi.fn();
  public updateLayout = vi.fn();
  public deleteLayout = vi.fn();
  public overwriteLayout = vi.fn();
  public revertLayout = vi.fn();
  public makePersonalCopy = vi.fn();
  public syncWithRemote = vi.fn();
}
