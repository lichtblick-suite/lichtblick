/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { PropsWithChildren } from "react";

import useContextSelector from "@foxglove/studio-base/hooks/useContextSelector";
import createSelectableContext, {
  SelectableContext,
} from "@foxglove/studio-base/util/createSelectableContext";

describe("createSelectableContext/useContextSelector", () => {
  function createTestConsumer<T, U>(ctx: SelectableContext<T>, selector: (arg0: T) => U) {
    function Consumer() {
      const value = useContextSelector(ctx, Consumer.selectorFn);
      Consumer.renderFn(value);
      return ReactNull;
    }
    Consumer.selectorFn = jest.fn().mockImplementation(selector);
    Consumer.renderFn = jest.fn();
    return Consumer;
  }

  it("throws when selector is used outside a provider", () => {
    jest.spyOn(console, "error").mockReturnValue(); // Library logs an error.
    const C = createSelectableContext();
    const Consumer = createTestConsumer(C, (x) => x);

    expect(() => render(<Consumer />)).toThrow(
      "useContextSelector was used outside a corresponding <Provider />.",
    );

    (console.error as any).mockClear();
  });

  it("calls selector and render once with initial value", () => {
    const C = createSelectableContext();
    const Consumer = createTestConsumer(C, (x) => x);

    const rootEl = (
      <C.Provider value={1}>
        <Consumer />
      </C.Provider>
    );
    const root = render(rootEl);

    root.rerender(rootEl);
    root.rerender(rootEl);

    expect(Consumer.selectorFn.mock.calls).toEqual([[1]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1]]);

    root.unmount();
  });

  it("doesn't render again when provided value and selector result change at the same time", () => {
    const C = createSelectableContext<number>();

    let value = 1;
    const all: number[] = [];
    const { rerender } = renderHook(({ selector }) => all.push(useContextSelector(C, selector)), {
      initialProps: { selector: (x: number) => x * 2 },
      wrapper: ({ children }) => <C.Provider value={value}>{children}</C.Provider>,
    });

    expect(all).toEqual([2]);
    value = 2;
    rerender({ selector: (x) => x * 3 });
    expect(all).toEqual([2, 6]);
  });

  it("re-renders when selector returns new value", () => {
    const C = createSelectableContext<{ num: number }>();
    let prevValue = -1;
    const Consumer = createTestConsumer(C, ({ num }) => {
      if (num === 3) {
        return prevValue;
      }
      prevValue = num;
      return num;
    });

    const consumer = <Consumer />;
    const root = render(<C.Provider value={{ num: 1 }}>{consumer}</C.Provider>);

    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1]]);

    root.rerender(<C.Provider value={{ num: 1 }}>{consumer}</C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }], [{ num: 1 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1]]);

    root.rerender(<C.Provider value={{ num: 2 }}>{consumer}</C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }], [{ num: 1 }], [{ num: 2 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1], [2]]);

    // Selector returns the same value, so no update should occur
    root.rerender(<C.Provider value={{ num: 3 }}>{consumer}</C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([
      [{ num: 1 }],
      [{ num: 1 }],
      [{ num: 2 }],
      [{ num: 3 }],
    ]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1], [2]]);

    root.rerender(<C.Provider value={{ num: 4 }}>{consumer}</C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([
      [{ num: 1 }],
      [{ num: 1 }],
      [{ num: 2 }],
      [{ num: 3 }],
      [{ num: 4 }],
    ]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1], [2], [4]]);

    root.unmount();
  });

  it("propagates value to multiple consumers, including memoized subtrees", () => {
    const C = createSelectableContext<{ one: number; two: number }>();
    const Consumer1 = createTestConsumer(C, ({ one }) => one);
    const Consumer2 = createTestConsumer(C, ({ two }) => two);

    const Memoized = React.memo(function Memoized({ children }: PropsWithChildren<unknown>) {
      return <div>{children}</div>;
    });

    const children = (
      <>
        <Consumer1 />
        <Memoized>
          <Consumer2 />
        </Memoized>
      </>
    );
    const root = render(<C.Provider value={{ one: 1, two: 2 }}>{children}</C.Provider>);

    expect(Consumer1.selectorFn).toHaveBeenCalledTimes(1);
    expect(Consumer1.renderFn.mock.calls).toEqual([[1]]);
    expect(Consumer2.selectorFn).toHaveBeenCalledTimes(1);
    expect(Consumer2.renderFn.mock.calls).toEqual([[2]]);

    root.rerender(<C.Provider value={{ one: 1, two: 22 }}>{children}</C.Provider>);
    expect(Consumer1.selectorFn).toHaveBeenCalledTimes(2);
    expect(Consumer1.renderFn.mock.calls).toEqual([[1]]);
    expect(Consumer2.selectorFn).toHaveBeenCalledTimes(2);
    expect(Consumer2.renderFn.mock.calls).toEqual([[2], [22]]);

    root.rerender(<C.Provider value={{ one: 11, two: 22 }}>{children}</C.Provider>);
    expect(Consumer1.selectorFn).toHaveBeenCalledTimes(3);
    expect(Consumer1.renderFn.mock.calls).toEqual([[1], [11]]);
    expect(Consumer2.selectorFn).toHaveBeenCalledTimes(3);
    expect(Consumer2.renderFn.mock.calls).toEqual([[2], [22]]);

    root.unmount();
  });

  it("doesn't call selector after unmount", () => {
    const C = createSelectableContext<{ num: number }>();
    const Consumer = createTestConsumer(C, ({ num }) => num);

    const children = <Consumer />;
    const root = render(<C.Provider value={{ num: 1 }}>{children}</C.Provider>);

    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1]]);

    root.rerender(<C.Provider value={{ num: 2 }}>{children}</C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }], [{ num: 2 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1], [2]]);

    root.rerender(<C.Provider value={{ num: 2 }}></C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }], [{ num: 2 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1], [2]]);

    root.rerender(<C.Provider value={{ num: 3 }}></C.Provider>);
    expect(Consumer.selectorFn.mock.calls).toEqual([[{ num: 1 }], [{ num: 2 }]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[1], [2]]);

    root.unmount();
  });

  it("batches updates when a component subscribes multiple times", () => {
    const C = createSelectableContext();

    const selector1 = jest.fn().mockImplementation(({ x }) => x);
    const selector2 = jest.fn().mockImplementation(({ y }) => y);
    const selector3 = jest.fn().mockImplementation(({ z }) => z);

    const renderFn = jest.fn();

    function clearMocks() {
      selector1.mockClear();
      selector2.mockClear();
      selector3.mockClear();
      renderFn.mockClear();
    }

    function Test() {
      const x = useContextSelector(C, selector1);
      const y = useContextSelector(C, selector2);
      const z = useContextSelector(C, selector3);
      renderFn([x, y, z]);
      return ReactNull;
    }

    const children = <Test />;
    const root = render(<C.Provider value={{ x: 0, y: 0, z: 0 }}>{children}</C.Provider>);

    expect(selector1.mock.calls).toEqual([[{ x: 0, y: 0, z: 0 }]]);
    expect(selector2.mock.calls).toEqual([[{ x: 0, y: 0, z: 0 }]]);
    expect(selector3.mock.calls).toEqual([[{ x: 0, y: 0, z: 0 }]]);
    expect(renderFn.mock.calls).toEqual([[[0, 0, 0]]]);

    clearMocks();
    root.rerender(<C.Provider value={{ x: 1, y: 0, z: 0 }}>{children}</C.Provider>);
    expect(selector1.mock.calls).toEqual([[{ x: 1, y: 0, z: 0 }]]);
    expect(selector2.mock.calls).toEqual([[{ x: 1, y: 0, z: 0 }]]);
    expect(selector3.mock.calls).toEqual([[{ x: 1, y: 0, z: 0 }]]);
    expect(renderFn.mock.calls).toEqual([[[1, 0, 0]]]);

    clearMocks();
    root.rerender(<C.Provider value={{ x: 1, y: 2, z: 3 }}>{children}</C.Provider>);
    expect(selector1.mock.calls).toEqual([[{ x: 1, y: 2, z: 3 }]]);
    expect(selector2.mock.calls).toEqual([[{ x: 1, y: 2, z: 3 }]]);
    expect(selector3.mock.calls).toEqual([[{ x: 1, y: 2, z: 3 }]]);
    expect(renderFn.mock.calls).toEqual([[[1, 2, 3]]]);

    root.unmount();
  });

  it("works with function values", () => {
    const C = createSelectableContext();
    const Consumer = createTestConsumer(C, (x) => x);

    const fn1 = () => {
      throw new Error("should not be called");
    };
    const fn2 = () => {
      throw new Error("should not be called");
    };
    const children = <Consumer />;
    const root = render(<C.Provider value={fn1}>{children}</C.Provider>);

    root.rerender(<C.Provider value={fn2}>{children}</C.Provider>);

    expect(Consumer.selectorFn.mock.calls).toEqual([[fn1], [fn2]]);
    expect(Consumer.renderFn.mock.calls).toEqual([[fn1], [fn2]]);

    root.unmount();
  });
});
