// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { ChangeEvent, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest, useUnmount } from "react-use";

import Stack from "@foxglove/studio-base/components/Stack";
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
  const [selectedKey, setSelectedKey] = useState<string>(defaultSelectedKey);

  const handleChoiceGroupChange = React.useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setSelectedKey((event.target as HTMLInputElement).value);
    },
    [],
  );

  const [personalCopyName, setPersonalCopyName] = useState(
    defaultPersonalCopyName ?? `${layout.name} copy`,
  );
  const personalCopyNameRef = useLatest(personalCopyName);

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPersonalCopyName(event.target.value);
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
    <Dialog open onClose={handleCancel} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{`“${layout.name}” has unsaved changes`}</DialogTitle>
        <DialogContent>
          <Stack gap={2} style={{ minHeight: 180 }}>
            <RadioGroup defaultValue="discard" onChange={handleChoiceGroupChange}>
              <FormControlLabel value="discard" label="Discard changes" control={<Radio />} />
              <FormControlLabel
                value="overwrite"
                label={[
                  `Update team layout “${layout.name}”`,
                  !isOnline && "(unavailable while offline)",
                ]
                  .filter(Boolean)
                  .join(" ")}
                control={<Radio />}
                disabled={!isOnline}
              />
              <FormControlLabel
                value="makePersonal"
                label="Save a personal copy"
                control={<Radio />}
              />
            </RadioGroup>
            {selectedKey === "discard" && (
              <Typography variant="body2" color="error.main">
                Your changes will be permantly deleted. This cannot be undone.
              </Typography>
            )}
            {selectedKey === "makePersonal" && (
              <TextField
                autoFocus
                variant="outlined"
                label="Layout name"
                value={personalCopyName}
                onChange={handleNameChange}
                error={nameError != undefined}
                helperText={nameError}
                FormHelperTextProps={{
                  variant: "standard",
                }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" size="large" color="inherit" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="large"
            variant="contained"
            color={selectedKey === "discard" ? "error" : "primary"}
            disabled={selectedKey === "makePersonal" && nameError != undefined}
          >
            {selectedKey === "discard" ? "Discard changes" : "Save"}
          </Button>
        </DialogActions>
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
