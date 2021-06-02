// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useRef, useState, Fragment } from "react";

import ModalContext from "@foxglove/studio-base/context/ModalContext";

export default function ModalHost({
  children,
}: React.PropsWithChildren<unknown>): React.ReactElement {
  const [elements, setElements] = useState(new Map<number, React.ReactNode>());
  const nextId = useRef(0);

  const value = useMemo(
    () => ({
      addModalElement(el: React.ReactNode) {
        const id = ++nextId.current;
        setElements((els) => {
          const newElements = new Map(els);
          newElements.set(id, el);
          return newElements;
        });

        return () => {
          setElements((els) => {
            const newElements = new Map(els);
            newElements.delete(id);
            return newElements;
          });
        };
      },
    }),
    [],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      {Array.from(elements, ([id, el]) => {
        return <Fragment key={id}>{el}</Fragment>;
      })}
    </ModalContext.Provider>
  );
}
