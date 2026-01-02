// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type FoxgloveMessages = {
  "foxglove.GeoJSON": {
    geojson: string;
  };

  "foxglove.Pose": {
    position: { x: number; y: number; z: number };
    orientation: { x: number; y: number; z: number; w: number };
  };
};
