// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getAccuracy } from "@foxglove/studio-base/panels/Map/getAccuracy";
import {
  NavSatFixMsg,
  NavSatFixPositionCovarianceType,
} from "@foxglove/studio-base/panels/Map/types";

describe("getAccuracy", () => {
  const position = {
    latitude: 0,
    longitude: 0,
    altitude: 0,
  };

  it("handles 'diagonal' covariance type", () => {
    const msg: NavSatFixMsg = {
      ...position,
      position_covariance: [25, 0, 0, 0, 100, 0, 0, 0, 10000],
      position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_DIAGONAL_KNOWN,
    };
    const {
      radii: [r1, r2],
      tilt,
    } = getAccuracy(msg)!;
    expect(r1).toBeCloseTo(5);
    expect(r2).toBeCloseTo(10);
    expect(tilt).toBeCloseTo(0);
  });

  describe("'known' covariance type", () => {
    it("may return circular variance", () => {
      const msg: NavSatFixMsg = {
        ...position,
        position_covariance: [25, 0, 0, 0, 25, 0, 0, 0, 0],
        position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN,
      };
      const {
        radii: [r1, r2],
      } = getAccuracy(msg)!;
      expect(r1).toBe(5);
      expect(r2).toBe(5);
    });

    it("may return a NW ellipsoid", () => {
      const msg: NavSatFixMsg = {
        ...position,
        position_covariance: [3, -2, 0, -2, 3, 0, 0, 0, 0],
        position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN,
      };
      const {
        radii: [r1, r2],
        tilt,
      } = getAccuracy(msg)!;
      expect(r1).toBeCloseTo(2.236);
      expect(r2).toBeCloseTo(1);
      expect(tilt).toBeCloseTo(45);
    });

    it("may return a NE ellipsoid", () => {
      const msg: NavSatFixMsg = {
        ...position,
        position_covariance: [3, 2, 0, 2, 3, 0, 0, 0, 0],
        position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN,
      };
      const {
        radii: [r1, r2],
        tilt,
      } = getAccuracy(msg)!;
      expect(r1).toBeCloseTo(2.236);
      expect(r2).toBeCloseTo(1);
      expect(tilt).toBeCloseTo(-45);
    });

    it("handles zero invariance", () => {
      const msg: NavSatFixMsg = {
        ...position,
        position_covariance: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN,
      };
      const {
        radii: [r1, r2],
      } = getAccuracy(msg)!;
      expect(r1).toBeCloseTo(0);
      expect(r2).toBeCloseTo(0);
    });

    it("returns undefined for invalid input", () => {
      const msg: NavSatFixMsg = {
        ...position,
        position_covariance: [1, -1, 0, 1, 1, 0, 0, 0, 0],
        position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN,
      };
      expect(getAccuracy(msg)).toBeUndefined();
    });
  });
});
