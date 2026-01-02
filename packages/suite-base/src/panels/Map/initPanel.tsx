// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import L from "leaflet";
import LeafletRetinaIconUrl from "leaflet/dist/images/marker-icon-2x.png";
import LeafletIconUrl from "leaflet/dist/images/marker-icon.png";
import LeafletShadowIconUrl from "leaflet/dist/images/marker-shadow.png";

import { useCrash } from "@lichtblick/hooks";
import { PanelExtensionContext } from "@lichtblick/suite";
import { CaptureErrorBoundary } from "@lichtblick/suite-base/components/CaptureErrorBoundary";
import { createSyncRoot } from "@lichtblick/suite-base/panels/createSyncRoot";

import MapPanel from "./MapPanel";

import "leaflet/dist/leaflet.css";

// Webpack and leaflet don't work well out of the box without manually
// overriding the default icon and its asset paths.
L.Marker.prototype.options.icon = L.icon({
  iconUrl: LeafletIconUrl,
  iconRetinaUrl: LeafletRetinaIconUrl,
  shadowUrl: LeafletShadowIconUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

export function initPanel(
  crash: ReturnType<typeof useCrash>,
  context: PanelExtensionContext,
): () => void {
  return createSyncRoot(
    <CaptureErrorBoundary onError={crash}>
      <MapPanel context={context} />
    </CaptureErrorBoundary>,
    context.panelElement,
  );
}
