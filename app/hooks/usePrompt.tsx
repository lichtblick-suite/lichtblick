// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useRef, useState } from "react";
import { render, unmountComponentAtNode } from "react-dom";
import styled from "styled-components";

import Button from "@foxglove-studio/app/components/Button";
import Modal from "@foxglove-studio/app/components/Modal";

const ModalContent = styled.div`
  overflow-y: auto;
  padding: 25px;
  padding-top: 48px;
  width: 300px;
`;

const ModalActions = styled.div`
  padding-top: 10px;
  text-align: right;
`;

type PromptOptions = {
  placeholder?: string;
  value?: string;
};

type ModalPromptProps = {
  onComplete: (value: string | undefined) => void;
  placeholder?: string;
  value?: string;
};

function ModalPrompt({ onComplete, placeholder, value: initialValue }: ModalPromptProps) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(ReactNull);

  // select any existing input text on first display
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <Modal onRequestClose={() => onComplete(undefined)}>
      <ModalContent>
        <div>
          <input
            ref={inputRef}
            style={{ width: "100%" }}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <ModalActions>
          <Button onClick={() => onComplete(undefined)}>Cancel</Button>
          <Button primary={true} onClick={() => onComplete(value)}>
            OK
          </Button>
        </ModalActions>
      </ModalContent>
    </Modal>
  );
}

// Returns a function that can be used similarly to the DOM prompt(), but
// backed by a React element rather than a native modal, and asynchronous.
export function usePrompt(): (options?: PromptOptions) => Promise<string | undefined> {
  const [container] = useState(
    (): HTMLDivElement => {
      const element = document.createElement("div");
      document.body.append(element);
      return element;
    },
  );

  useEffect(() => {
    return () => {
      container.remove();
      unmountComponentAtNode(container);
    };
  }, [container]);

  const runPrompt = useCallback(
    (options?: PromptOptions) => {
      return new Promise<string | undefined>((resolve) => {
        render(
          <ModalPrompt
            placeholder={options?.placeholder}
            value={options?.value}
            onComplete={(value) => {
              unmountComponentAtNode(container);
              resolve(value);
            }}
          />,
          container,
        );
      });
    },
    [container],
  );

  return runPrompt;
}
