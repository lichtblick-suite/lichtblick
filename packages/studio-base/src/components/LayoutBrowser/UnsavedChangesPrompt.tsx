// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ChoiceGroup,
  IChoiceGroupOption,
  Dialog,
  DialogFooter,
  Stack,
  Text,
  TextField,
  useTheme,
  DefaultButton,
  PrimaryButton,
} from "@fluentui/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest, useUnmount } from "react-use";

import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

type UnsavedChangesResolution =
  | { type: "cancel" }
  | { type: "discard" }
  | { type: "makePersonal"; name: string }
  | { type: "overwrite" };

export function UnsavedChangesPrompt({
  layout,
  isOnline,
  onComplete,
  defaultSelectedKey = "discard",
  defaultPersonalCopyName,
}: {
  layout: Layout;
  isOnline: boolean;
  onComplete: (_: UnsavedChangesResolution) => void;
  defaultSelectedKey?: Exclude<UnsavedChangesResolution["type"], "cancel">;
  defaultPersonalCopyName?: string;
}): JSX.Element {
  const theme = useTheme();

  const options = useMemo<
    (IChoiceGroupOption & { key: Exclude<UnsavedChangesResolution["type"], "cancel"> })[]
  >(
    () => [
      { key: "discard", text: "Discard changes" },
      {
        key: "overwrite",
        text: `Update team layout “${layout.name}”${
          !isOnline ? " (unavailable while offline)" : ""
        }`,
        disabled: !isOnline,
      },
      { key: "makePersonal", text: "Save a personal copy" },
    ],
    [isOnline, layout.name],
  );
  const [selectedKey, setSelectedKey] = useState(defaultSelectedKey);

  const handleChoiceGroupChange = React.useCallback(
    (_event: React.FormEvent | undefined, option: IChoiceGroupOption | undefined): void => {
      if (option) {
        setSelectedKey(option.key as typeof options[0]["key"]);
      }
    },
    [],
  );

  const [personalCopyName, setPersonalCopyName] = useState(
    defaultPersonalCopyName ?? `${layout.name} copy`,
  );
  const personalCopyNameRef = useLatest(personalCopyName);
  const handleNameChange = useCallback((_event: React.FormEvent, value: string | undefined) => {
    if (value != undefined) {
      setPersonalCopyName(value);
    }
  }, []);
  const nameError = useMemo(
    () => (personalCopyName.length === 0 ? "Name cannot be empty" : undefined),
    [personalCopyName],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      switch (selectedKey) {
        case "discard":
          onComplete({ type: "discard" });
          break;
        case "overwrite":
          onComplete({ type: "overwrite" });
          break;
        case "makePersonal":
          onComplete({ type: "makePersonal", name: personalCopyNameRef.current });
          break;
      }
    },
    [onComplete, personalCopyNameRef, selectedKey],
  );

  const handleCancel = useCallback(() => {
    onComplete({ type: "cancel" });
  }, [onComplete]);

  return (
    <Dialog
      hidden={false}
      onDismiss={handleCancel}
      dialogContentProps={{ title: `“${layout.name}” has unsaved changes` }}
      minWidth={320}
      maxWidth={320}
    >
      <form onSubmit={handleSubmit}>
        <Stack tokens={{ childrenGap: theme.spacing.m }} styles={{ root: { minHeight: 180 } }}>
          <ChoiceGroup
            selectedKey={selectedKey}
            options={options}
            onChange={handleChoiceGroupChange}
            required={true}
          />
          {selectedKey === "discard" && (
            <Text styles={{ root: { color: theme.semanticColors.bodySubtext } }}>
              Your changes will be permantly deleted. This cannot be undone.
            </Text>
          )}
          {selectedKey === "makePersonal" && (
            <TextField
              autoFocus
              label="Layout name"
              value={personalCopyName}
              onChange={handleNameChange}
              errorMessage={nameError}
            />
          )}
        </Stack>
        <DialogFooter styles={{ actions: { whiteSpace: "nowrap" } }}>
          <DefaultButton text="Cancel" onClick={handleCancel} />
          <PrimaryButton
            type="submit"
            text={selectedKey === "discard" ? "Discard changes" : "Save"}
            styles={
              selectedKey === "discard"
                ? {
                    root: { backgroundColor: "#c72121", borderColor: "#c72121", color: "white" },
                    rootHovered: {
                      backgroundColor: "#b31b1b",
                      borderColor: "#b31b1b",
                      color: "white",
                    },
                    rootPressed: {
                      backgroundColor: "#771010",
                      borderColor: "#771010",
                      color: "white",
                    },
                  }
                : {}
            }
            disabled={selectedKey === "makePersonal" && nameError != undefined}
          />
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export function useUnsavedChangesPrompt(): {
  unsavedChangesPrompt?: JSX.Element;
  openUnsavedChangesPrompt: (item: Layout) => Promise<UnsavedChangesResolution>;
} {
  const [layout, setLayout] = useState<Layout | undefined>();
  const resolveRef = useRef<(res: UnsavedChangesResolution) => void>();

  const layoutManager = useLayoutManager();
  const [isOnline, setIsOnline] = useState(layoutManager.isOnline);
  useLayoutEffect(() => {
    const onlineListener = () => setIsOnline(layoutManager.isOnline);
    onlineListener();
    layoutManager.on("onlinechange", onlineListener);
    return () => layoutManager.off("onlinechange", onlineListener);
  }, [layoutManager]);

  const unsavedChangesPrompt = useMemo(() => {
    if (!layout) {
      return undefined;
    }
    return (
      <UnsavedChangesPrompt
        layout={layout}
        isOnline={isOnline}
        onComplete={(value) => {
          resolveRef.current?.(value);
          resolveRef.current = undefined;
          setLayout(undefined);
        }}
      />
    );
  }, [isOnline, layout]);

  const openUnsavedChangesPrompt = useCallback(async (item: Layout) => {
    setLayout(item);
    return await new Promise<UnsavedChangesResolution>((resolve) => {
      resolveRef.current?.({ type: "cancel" });
      resolveRef.current = resolve;
    });
  }, []);

  // Close automatically when unmounted
  useUnmount(() => {
    resolveRef.current?.({ type: "cancel" });
  });
  return { unsavedChangesPrompt, openUnsavedChangesPrompt };
}
