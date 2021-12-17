// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, Stack, TextField, useTheme } from "@fluentui/react";
import { useState, useMemo, useCallback, useLayoutEffect } from "react";

import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import View from "./View";

type ConnectionProps = {
  onBack?: () => void;
  onCancel?: () => void;
  availableSources: IDataSourceFactory[];
};

export default function Connection(props: ConnectionProps): JSX.Element {
  const { availableSources, onCancel, onBack } = props;

  const { selectSource } = usePlayerSelection();
  const theme = useTheme();
  const [selectedConnectionIdx, setSelectedConnectionIdx] = useState<number>(0);

  // List enabled sources before disabled sources so the default selected item is an available source
  const enabledSourcesFirst = useMemo(() => {
    const enabledSources = availableSources.filter((source) => source.disabledReason == undefined);
    const disabledSources = availableSources.filter((source) => source.disabledReason);
    return [...enabledSources, ...disabledSources];
  }, [availableSources]);

  const selectedSource = useMemo(
    () => enabledSourcesFirst[selectedConnectionIdx],
    [enabledSourcesFirst, selectedConnectionIdx],
  );

  const [fieldValues, setFieldValues] = useState<Record<string, string | undefined>>({});

  // clear field values when the user changes the source tab
  useLayoutEffect(() => {
    const defaultFieldValues: Record<string, string | undefined> = {};
    for (const field of selectedSource?.formConfig?.fields ?? []) {
      if (field.defaultValue != undefined) {
        defaultFieldValues[field.id] = field.defaultValue;
      }
    }
    setFieldValues(defaultFieldValues);
  }, [selectedSource]);

  const onOpen = useCallback(() => {
    if (!selectedSource) {
      return;
    }
    selectSource(selectedSource.id, { type: "connection", params: fieldValues });
  }, [selectedSource, fieldValues, selectSource]);

  return (
    <View
      onBack={onBack}
      onCancel={onCancel}
      onOpen={selectedSource?.disabledReason == undefined ? onOpen : undefined}
    >
      <Stack grow verticalFill horizontal tokens={{ childrenGap: theme.spacing.l2 }}>
        <Stack
          verticalFill
          styles={{
            root: { marginLeft: `-${theme.spacing.s1}` },
          }}
        >
          {enabledSourcesFirst.map((source, idx) => {
            const { id, iconName, displayName } = source;
            return (
              <ActionButton
                checked={idx === selectedConnectionIdx}
                key={id}
                iconProps={{ iconName }}
                onClick={() => setSelectedConnectionIdx(idx)}
                styles={{
                  root: { minWidth: 240 },
                  rootChecked: { backgroundColor: theme.semanticColors.bodyBackgroundHovered },
                  iconChecked: { color: theme.palette.themePrimary },
                }}
              >
                {displayName}
              </ActionButton>
            );
          })}
        </Stack>
        <Stack grow verticalFill key={selectedSource?.id} tokens={{ childrenGap: theme.spacing.m }}>
          {selectedSource?.formConfig != undefined && (
            <Stack grow verticalAlign="space-between">
              <Stack tokens={{ childrenGap: theme.spacing.m }}>
                {selectedSource?.formConfig.fields.map((field) => (
                  <TextField
                    disabled={selectedSource?.disabledReason != undefined}
                    key={field.label}
                    label={field.label}
                    placeholder={field.placeholder}
                    defaultValue={field.defaultValue}
                    onChange={(_, newValue) => {
                      setFieldValues((existing) => {
                        return {
                          ...existing,
                          [field.id]: newValue ?? field.defaultValue,
                        };
                      });
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          )}
          {selectedSource?.disabledReason}
        </Stack>
      </Stack>
    </View>
  );
}
