// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useState } from "react";
import { render, unmountComponentAtNode } from "react-dom";
import styled from "styled-components";

import Button from "@foxglove-studio/app/components/Button";
import Modal from "@foxglove-studio/app/components/Modal";
import TextField from "@foxglove-studio/app/components/TextField";

const ModalContent = styled.div`
  overflow-y: auto;
  padding: 25px;
  padding-top: 48px;
  width: 300px;
`;

const ModalTitle = styled.h2`
  font-size: 1.5em;
  margin-bottom: 1em;
`;

const ModalActions = styled.div`
  padding-top: 10px;
  text-align: right;
`;

type PromptOptions = {
  title?: string;
  placeholder?: string;
  value?: string;

  // Map the user-provided value to another value before returning it from prompt(). This function
  // may throw an error; if it does, it will present as a validation error and the user will not be
  // allowed to submit the prompt. (Note: ideally this would be generic `(value: string) => T`, but
  // when doing that it's hard to keep it as an optional field since there is only a sensible
  // default when T == string. See https://github.com/microsoft/TypeScript/issues/43425)
  transformer?: (value: string) => string;
};

type ModalPromptProps = PromptOptions & {
  onComplete: (value: string | undefined) => void;
};

function ModalPrompt({
  onComplete,
  title,
  placeholder,
  value: initialValue,
  transformer,
}: ModalPromptProps) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [error, setError] = useState<string | undefined>();

  const validator = useCallback(
    (str: string) => {
      try {
        transformer?.(str);
      } catch (err) {
        return err.toString();
      }
    },
    [transformer],
  );

  return (
    <Modal onRequestClose={() => onComplete(undefined)}>
      <ModalContent>
        <div>
          {title != undefined && <ModalTitle>{title}</ModalTitle>}
          <TextField
            selectOnMount
            placeholder={placeholder}
            value={value}
            onChange={setValue}
            onError={setError}
            validator={validator}
          />
        </div>
        <ModalActions>
          <Button onClick={() => onComplete(undefined)}>Cancel</Button>
          <Button
            primary={true}
            disabled={value === "" || error != undefined}
            onClick={() => onComplete(transformer ? transformer(value) : value)}
          >
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
            {...options}
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
