// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Link, Tab, Tabs, Typography } from "@mui/material";
import { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { makeStyles } from "tss-react/mui";

import { BuiltinIcon } from "@foxglove/studio-base/components/BuiltinIcon";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import { FormField } from "./FormField";
import View from "./View";

type ConnectionProps = {
  onBack?: () => void;
  onCancel?: () => void;
  availableSources: IDataSourceFactory[];
  activeSource?: IDataSourceFactory;
};

const useStyles = makeStyles()((theme) => ({
  indicator: {
    right: 0,
    width: "100%",
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
  },
  tab: {
    textAlign: "right",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    minHeight: "auto",
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),

    "> span, > .MuiSvgIcon-root": {
      display: "flex",
      color: theme.palette.primary.main,
      marginRight: theme.spacing(1.5),
      height: theme.typography.pxToRem(21),
      width: theme.typography.pxToRem(21),
    },
    svg: {
      fontSize: "inherit",
    },
  },
}));

export default function Connection(props: ConnectionProps): JSX.Element {
  const { availableSources, activeSource, onCancel, onBack } = props;
  const { classes } = useStyles();

  const { selectSource } = usePlayerSelection();
  const analytics = useAnalytics();

  // List enabled sources before disabled sources so the default selected item is an available source
  const enabledSourcesFirst = useMemo(() => {
    const enabledSources = availableSources.filter((source) => source.disabledReason == undefined);
    const disabledSources = availableSources.filter((source) => source.disabledReason);
    return [...enabledSources, ...disabledSources];
  }, [availableSources]);

  const [selectedConnectionIdx, setSelectedConnectionIdx] = useState<number>(() => {
    const foundIdx = availableSources.findIndex((source) => source === activeSource);
    const selectedIdx = foundIdx < 0 ? 0 : foundIdx;
    void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, {
      type: "live",
      data: enabledSourcesFirst[selectedIdx]?.id,
    });
    return selectedIdx;
  });

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
        <Stack flexBasis={240}>
          <Tabs
            classes={{ indicator: classes.indicator }}
            textColor="inherit"
            orientation="vertical"
            onChange={(_event, newValue: number) => {
              setSelectedConnectionIdx(newValue);
              void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, {
                type: "live",
                data: enabledSourcesFirst[newValue]?.id,
              });
            }}
            value={selectedConnectionIdx}
          >
            {enabledSourcesFirst.map((source, idx) => {
              const { id, iconName, displayName } = source;
              return (
                <Tab
                  value={idx}
                  key={id}
                  icon={<BuiltinIcon name={iconName ?? "Flow"} />}
                  label={displayName}
                  className={classes.tab}
                />
              );
            })}
          </Tabs>
        </Stack>
        <Stack key={selectedSource?.id} flex="1 0" gap={2}>
          {selectedSource?.disabledReason == undefined && selectedSource?.warning && (
            <Alert severity="warning">{selectedSource.warning}</Alert>
          )}
          {selectedSource?.disabledReason != undefined && (
            <Alert severity="warning">{selectedSource.disabledReason}</Alert>
          )}

          {selectedSource?.description && <Typography>{selectedSource.description}</Typography>}
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
          {selectedSource?.docsLink && (
            <Link color="primary" href={selectedSource.docsLink}>
              View docs.
            </Link>
          )}
        </Stack>
      </Stack>
    </View>
  );
}
