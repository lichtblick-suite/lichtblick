// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, useTheme } from "@fluentui/react";
import { Link, Typography } from "@mui/material";
import { useState, useMemo, useCallback, useLayoutEffect } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import { FormField } from "./FormField";
import View from "./View";

type ConnectionProps = {
  onBack?: () => void;
  onCancel?: () => void;
  availableSources: IDataSourceFactory[];
  activeSource?: IDataSourceFactory;
};

export default function Connection(props: ConnectionProps): JSX.Element {
  const { availableSources, activeSource, onCancel, onBack } = props;

  const { selectSource } = usePlayerSelection();
  const theme = useTheme();
  const [selectedConnectionIdx, setSelectedConnectionIdx] = useState<number>(() => {
    const foundIdx = availableSources.findIndex((source) => source === activeSource);
    return foundIdx < 0 ? 0 : foundIdx;
  });

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

  const [fieldErrors, setFieldErrors] = useState(new Map<string, string>());
  const [fieldValues, setFieldValues] = useState<Record<string, string | undefined>>({});

  useLayoutEffect(() => {
    const connectionIdx = availableSources.findIndex((source) => source === activeSource);
    if (connectionIdx >= 0) {
      setSelectedConnectionIdx(connectionIdx);
    }
  }, [activeSource, availableSources]);

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

  const disableOpen = selectedSource?.disabledReason != undefined || fieldErrors.size > 0;

  return (
    <View onBack={onBack} onCancel={onCancel} onOpen={disableOpen ? undefined : onOpen}>
      <Stack direction="row" flexGrow={1} flexWrap="wrap" fullHeight gap={4}>
        <Stack flex="0 0 240px">
          {enabledSourcesFirst.map((source, idx) => {
            const { id, iconName, displayName } = source;
            return (
              <ActionButton
                checked={idx === selectedConnectionIdx}
                key={id}
                iconProps={{ iconName }}
                onClick={() => setSelectedConnectionIdx(idx)}
                styles={{
                  rootChecked: { backgroundColor: theme.semanticColors.bodyBackgroundHovered },
                  icon: { "> span": { display: "flex" } },
                  iconChecked: { color: theme.palette.themePrimary },
                }}
              >
                {displayName}
              </ActionButton>
            );
          })}
        </Stack>
        <Stack key={selectedSource?.id} flex="1 0 240px" gap={2}>
          {selectedSource?.description && (
            <Typography color="text.secondary">{selectedSource.description}</Typography>
          )}

          {selectedSource?.formConfig != undefined && (
            <Stack flexGrow={1} justifyContent="space-between">
              <Stack gap={2}>
                {selectedSource.formConfig.fields.map((field) => (
                  <FormField
                    key={field.id}
                    field={field}
                    disabled={selectedSource.disabledReason != undefined}
                    onError={(err) => {
                      setFieldErrors((existing) => {
                        existing.set(field.id, err);
                        return new Map(existing);
                      });
                    }}
                    onChange={(newValue) => {
                      setFieldErrors((existing) => {
                        existing.delete(field.id);
                        return new Map(existing);
                      });
                      setFieldValues((existing) => {
                        return {
                          ...existing,
                          [field.id]: newValue,
                        };
                      });
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          )}
          {selectedSource?.disabledReason}

          {selectedSource?.docsLink && <Link href={selectedSource.docsLink}>View docs.</Link>}
        </Stack>
      </Stack>
    </View>
  );
}
