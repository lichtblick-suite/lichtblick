// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Calibration } from "./Calibration";
import { Model } from "./VelodyneTypes";

describe("Calibration", () => {
  it("does nothing", () => {
    const cal = new Calibration(Model.VLP16);
    expect(cal.model).toEqual(Model.VLP16);
    expect(cal.laserCorrections).toHaveLength(16);
  });
});
