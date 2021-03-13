// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import cx from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMountedState } from "react-use";

import styles from "./ShareJsonModal.module.scss";
import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Modal from "@foxglove-studio/app/components/Modal";
import { downloadTextFile } from "@foxglove-studio/app/util";
import clipboard from "@foxglove-studio/app/util/clipboard";

type Props = {
  onRequestClose: () => void;
  onChange?: (value: any) => void;
  value: unknown;
  noun: string;
};

function decode(value: string) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return JSON.parse(atob(value));
  }
}

function selectText(element?: HTMLTextAreaElement | null): void {
  if (element) {
    element.focus();
    element.select();
  }
}

export default function ShareJsonModal(props: Props) {
  const [copied, setCopied] = useState(false);
  const isMounted = useMountedState();
  const [value, setValue] = useState<string>((): string => {
    if (typeof props.value === "string") {
      return props.value;
    }
    return JSON.stringify(props.value, null, 2);
  });
  const [error, setError] = useState<Error>();

  // if the prop value changes, check it for errors
  useEffect(() => {
    const newVal = props.value ?? "{}";
    try {
      if (typeof newVal === "string") {
        setValue(newVal);
        decode(newVal);
      } else {
        setValue(JSON.stringify(newVal, null, 2));
      }
    } catch (err) {
      setError(err);
    }
  }, [props.value]);

  const onApply = useCallback(() => {
    if (value.length === 0) {
      setError(new Error("Empty layout"));
      return;
    }

    try {
      const decoded = decode(value);
      props.onChange && props.onChange(decoded);
      props.onRequestClose();
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Error parsing value from base64 json", err);
      }

      setError(err);
    }
  }, [props, value]);

  const onCopy = useCallback(() => {
    const val = value.length === 0 ? "{}" : value;
    clipboard.copy(val).then(() => {
      setCopied(true);
      setTimeout(() => {
        isMounted() && setCopied(false);
      }, 1500);
    });
  }, [isMounted, value]);

  const onDownload = useCallback(() => {
    const val = value.length === 0 ? "{}" : value;
    downloadTextFile(val, "layout.json");
  }, [value]);

  const renderError = useMemo(() => {
    if (!error) {
      return null;
    }
    return <div className="notification is-danger">The input you provided is invalid.</div>;
  }, [error]);

  return (
    <Modal
      onRequestClose={props.onRequestClose}
      contentStyle={{
        height: 400,
        width: 600,
        display: "flex",
      }}
    >
      <Flex col className={styles.container}>
        <p style={{ lineHeight: "22px" }}>
          <em>Paste a new {props.noun} to use it, or copy this one to share it:</em>
        </p>
        <textarea
          className={cx("textarea", styles.textarea)}
          value={value}
          onChange={(ev) => {
            setValue(ev.target.value);
            setError(undefined);
          }}
          data-nativeundoredo="true"
          ref={selectText}
        />
        {renderError}
        <div className={styles.buttonBar}>
          <Button primary onClick={onApply} className="test-apply">
            Apply
          </Button>
          <Button onClick={onDownload}>Download</Button>
          <Button onClick={onCopy}>{copied ? "Copied!" : "Copy"}</Button>
          <Button onClick={() => setValue("{}")}>Clear</Button>
        </div>
      </Flex>
    </Modal>
  );
}
