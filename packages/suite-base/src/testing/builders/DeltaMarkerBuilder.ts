// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DeltaMarker } from "@lichtblick/suite-base/panels/shared/deltaMarkers";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class DeltaMarkerBuilder {
  public static marker(props: Partial<DeltaMarker> = {}): DeltaMarker {
    return defaults<DeltaMarker>(props, {
      xValue: BasicBuilder.number(),
      seriesValues: [],
    });
  }
}
