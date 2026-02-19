// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { mathFunctions } from "@lichtblick/suite-base/panels/Plot/utils/mathFunctions";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("mathFunctions", () => {
  it("should correctly calculate the negative of a number", () => {
    const positiveNumber = BasicBuilder.number();
    const negativeNumber = positiveNumber * -1;

    expect(mathFunctions.negative(positiveNumber)).toBe(negativeNumber);
    expect(mathFunctions.negative(negativeNumber)).toBe(positiveNumber);
    expect(mathFunctions.negative(0)).toBe(-0);
  });

  it("should correctly convert degrees to radians", () => {
    expect(mathFunctions.deg2rad(0)).toBe(0);
    expect(mathFunctions.deg2rad(90)).toBeCloseTo(Math.PI / 2, 5);
    expect(mathFunctions.deg2rad(180)).toBeCloseTo(Math.PI, 5);
    expect(mathFunctions.deg2rad(360)).toBeCloseTo(2 * Math.PI, 5);
  });

  it("should correctly convert radians to degrees", () => {
    expect(mathFunctions.rad2deg(0)).toBe(0);
    expect(mathFunctions.rad2deg(Math.PI / 2)).toBeCloseTo(90, 5);
    expect(mathFunctions.rad2deg(Math.PI)).toBeCloseTo(180, 5);
    expect(mathFunctions.rad2deg(2 * Math.PI)).toBeCloseTo(360, 5);
  });
});
