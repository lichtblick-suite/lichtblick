// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { LatLngExpression, Path, PathOptions } from "leaflet";

// Types for leaflet-ellipse
// http://jdfergason.github.io/Leaflet.Ellipse/

declare module "leaflet" {
  type Radii = [number, number];

  class Ellipse extends Path {
    public constructor(latlng: LatLngExpression, radii: Radii, tilt: number, options?: PathOptions);

    public getLatLng(): LatLng;
    public setLatLng(latlng: LatLngExpression): Ellipse;

    public getTilt(): number;

    public getRadius(): Radii;
    public setRadius(radius: Radii): Ellipse;
  }

  function ellipse(
    latlng: LatLngExpression,
    radii: Radii,
    tilt: number,
    options?: PathOptions,
  ): Ellipse;
}
