/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";

import { useColorPickerControl } from "./ColorPickerControl";

describe("useColorPickerControl", () => {
  it("should emit expanded value for valid color entries for no-alpha", () => {
    let lastOnChange: string | undefined;

    const onChange = (val: string) => {
      lastOnChange = val;
    };

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useColorPickerControl>[0]) => useColorPickerControl(props),
      {
        initialProps: {
          alphaType: "none",
          value: undefined,
          onChange,
        },
      },
    );

    // When there's no display value the swatch color defaults to black with some opacity
    expect(result.current.swatchColor).toEqual("#00000044");

    act(() => {
      result.current.updateEditedValue("abc");
    });

    // After calling updateEditedValue, the edited value should be what the user entered
    expect(result.current.editedValue).toEqual("abc");

    // For an input of 'abc' we expect the last output value to be expanded to #aabbcc
    expect(lastOnChange).toEqual("#aabbcc");

    // Re-render with the new value
    rerender({
      alphaType: "none",
      value: lastOnChange,
      onChange,
    });

    // Edited value should remain unchanged
    expect(result.current.editedValue).toEqual("abc");

    // Switch color should be updated
    expect(result.current.swatchColor).toEqual("#aabbcc");
  });

  it("should emit expanded value for valid color entries for alpha", () => {
    let lastOnChange: string | undefined;

    const onChange = (val: string) => {
      lastOnChange = val;
    };

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useColorPickerControl>[0]) => useColorPickerControl(props),
      {
        initialProps: {
          alphaType: "alpha",
          value: undefined,
          onChange,
        },
      },
    );

    // When there's no display value the swatch color defaults to black with some opacity
    expect(result.current.swatchColor).toEqual("#00000044");

    act(() => {
      result.current.updateEditedValue("abc");
    });

    // After calling updateEditedValue, the edited value should be what the user entered
    expect(result.current.editedValue).toEqual("abc");

    // For an input of 'abc' we expect the last output value to be expanded to #aabbcc
    expect(lastOnChange).toEqual("#aabbccff");

    // Re-render with the new value
    rerender({
      alphaType: "alpha",
      value: lastOnChange,
      onChange,
    });

    // Edited value should remain unchanged
    expect(result.current.editedValue).toEqual("abc");

    // Switch color should be updated
    expect(result.current.swatchColor).toEqual("#aabbccff");
  });

  it("should update edited value with prop value", () => {
    const onChange = () => {};

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useColorPickerControl>[0]) => useColorPickerControl(props),
      {
        initialProps: {
          alphaType: "alpha",
          value: "abc",
          onChange,
        },
      },
    );

    act(() => {
      result.current.updateEditedValue("abc");
    });

    // Re-render with the new expanded value prop
    rerender({
      alphaType: "alpha",
      value: "aabbcc",
      onChange,
    });

    act(() => {
      result.current.onInputBlur();
    });

    // Edited value is updated to the input prop _value_ after the input blurs
    expect(result.current.editedValue).toEqual("aabbccff");
  });
});
