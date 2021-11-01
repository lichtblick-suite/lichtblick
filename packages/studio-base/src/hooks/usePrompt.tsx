// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DefaultButton,
  Dialog,
  DialogFooter,
  ITextField,
  PrimaryButton,
  TextField,
} from "@fluentui/react";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ModalContext from "@foxglove/studio-base/context/ModalContext";

type PromptOptions = {
  title: string;
  subText?: string;
  placeholder?: string;
  initialValue?: string;
  label?: string;

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
  onComplete: originalOnComplete,
  title,
  subText,
  placeholder,
  initialValue,
  label,
  transformer,
}: ModalPromptProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const errorMessage = useMemo<string | undefined>(() => {
    if (value === "") {
      return undefined;
    }
    try {
      transformer?.(value);
    } catch (err) {
      return err.toString();
    }
  }, [transformer, value]);

  const completed = useRef(false);
  const onComplete = useCallback(
    (result: string | undefined) => {
      if (!completed.current) {
        completed.current = true;
        originalOnComplete(result);
      }
    },
    [originalOnComplete],
  );
  // Ensure we still call onComplete(undefined) when the component unmounts, if it hasn't been
  // called already
  useEffect(() => {
    return () => onComplete(undefined);
  }, [onComplete]);

  // Select the text field on mount
  const [textField, setTextField] = useState<ITextField | ReactNull>(ReactNull);
  useLayoutEffect(() => {
    textField?.select();
  }, [textField]);

  return (
    <Dialog
      hidden={false}
      onDismiss={() => onComplete(undefined)}
      dialogContentProps={{ title, subText }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onComplete(transformer ? transformer(value) : value);
          } catch (err) {
            onComplete(undefined);
          }
        }}
      >
        <TextField
          label={label}
          componentRef={setTextField}
          placeholder={placeholder}
          value={value}
          errorMessage={errorMessage}
          onChange={(_, newValue) => setValue(newValue ?? "")}
        />
        <DialogFooter>
          <DefaultButton onClick={() => onComplete(undefined)} text="Cancel" />
          <PrimaryButton
            type="submit"
            disabled={value === "" || errorMessage != undefined}
            text="OK"
          />
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// Returns a function that can be used similarly to the DOM prompt(), but
// backed by a React element rather than a native modal, and asynchronous.
export function usePrompt(): (options: PromptOptions) => Promise<string | undefined> {
  const modalHost = useContext(ModalContext);

  const runPrompt = useCallback(
    async (options: PromptOptions) => {
      return await new Promise<string | undefined>((resolve) => {
        const remove = modalHost.addModalElement(
          <ModalPrompt
            {...options}
            onComplete={(value) => {
              resolve(value);
              remove();
            }}
          />,
        );
      });
    },
    [modalHost],
  );

  return runPrompt;
}

export type { PromptOptions };
