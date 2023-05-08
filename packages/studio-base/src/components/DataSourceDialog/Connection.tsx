// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Link, Tab, Tabs, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useState, useMemo, useCallback, useLayoutEffect, FormEvent } from "react";
import { makeStyles } from "tss-react/mui";

import { BuiltinIcon } from "@foxglove/studio-base/components/BuiltinIcon";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import {
  WorkspaceContextStore,
  useWorkspaceStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import { FormField } from "./FormField";
import View from "./View";

const useStyles = makeStyles()((theme) => ({
  grid: {
    padding: theme.spacing(4, 4, 0),
    columnGap: theme.spacing(4),
    rowGap: theme.spacing(2),

    [theme.breakpoints.up("md")]: {
      overflow: "hidden",
      display: "grid",
      padding: theme.spacing(4, 4, 0, 4),
      gridTemplateAreas: `
        "header header"
        "sidebar form"
      `,
      gridTemplateColumns: "240px 1fr",
      gridTemplateRows: "auto auto",
    },
  },
  header: {
    gridArea: "header",
  },
  form: {
    gridArea: "form",
    overflowY: "auto",
  },
  formInner: {
    [theme.breakpoints.up("md")]: {
      height: theme.spacing(43), // this is aproximately the height of the tallest form
    },
  },
  sidebar: {
    gridArea: "sidebar",
    overflowY: "auto",
  },
  tab: {
    "> svg:not(.MuiSvgIcon-root)": {
      display: "flex",
      flex: "none",
      color: theme.palette.primary.main,
      marginRight: theme.spacing(1.5),
    },
    [theme.breakpoints.up("md")]: {
      textAlign: "right",
      flexDirection: "row",
      justifyContent: "flex-start",
      alignItems: "center",
      minHeight: "auto",
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(1.5),
    },
  },
  indicator: {
    [theme.breakpoints.up("md")]: {
      right: 0,
      width: "100%",
      backgroundColor: theme.palette.action.hover,
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

const selectDataSourceDialog = (store: WorkspaceContextStore) => store.dialogs.dataSource;

export default function Connection(): JSX.Element {
  const { classes } = useStyles();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));

  const { activeDataSource } = useWorkspaceStore(selectDataSourceDialog);
  const { dialogActions } = useWorkspaceActions();

  const { availableSources, selectSource } = usePlayerSelection();
  const analytics = useAnalytics();

  // connectionSources is the list of availableSources supporting "connections"
  const connectionSources = useMemo(() => {
    return availableSources.filter((source) => {
      return source.type === "connection" && source.hidden !== true;
    });
  }, [availableSources]);

  // List enabled sources before disabled sources so the default selected item is an available source
  const enabledSourcesFirst = useMemo(() => {
    const enabledSources = connectionSources.filter((source) => source.disabledReason == undefined);
    const disabledSources = connectionSources.filter((source) => source.disabledReason);
    return [...enabledSources, ...disabledSources];
  }, [connectionSources]);

  const [selectedConnectionIdx, setSelectedConnectionIdx] = useState<number>(() => {
    const foundIdx = connectionSources.findIndex((source) => source === activeDataSource);
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
    const connectionIdx = connectionSources.findIndex((source) => source === activeDataSource);
    if (connectionIdx >= 0) {
      setSelectedConnectionIdx(connectionIdx);
    }
  }, [activeDataSource, connectionSources]);

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
    void analytics.logEvent(AppEvent.DIALOG_CLOSE, { activeDataSource });
    dialogActions.dataSource.close();
  }, [
    selectedSource,
    selectSource,
    fieldValues,
    analytics,
    activeDataSource,
    dialogActions.dataSource,
  ]);

  const disableOpen = selectedSource?.disabledReason != undefined || fieldErrors.size > 0;

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!disableOpen) {
        onOpen();
      }
    },
    [disableOpen, onOpen],
  );

  return (
    <View onOpen={disableOpen ? undefined : onOpen}>
      <Stack className={classes.grid}>
        <header className={classes.header}>
          <Typography variant="h3" fontWeight={600} gutterBottom>
            Open a new connection
          </Typography>
        </header>
        <div className={classes.sidebar}>
          <Tabs
            classes={{ indicator: classes.indicator }}
            variant="scrollable"
            textColor="inherit"
            orientation={mdUp ? "vertical" : "horizontal"}
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
                  icon={mdUp ? <BuiltinIcon name={iconName ?? "Flow"} /> : undefined}
                  label={displayName}
                  className={classes.tab}
                />
              );
            })}
          </Tabs>
        </div>

        <Stack className={classes.form} key={selectedSource?.id} flex="1 0">
          <form onSubmit={onSubmit}>
            <Stack className={classes.formInner} gap={2}>
              {selectedSource?.disabledReason == undefined &&
                selectedSource?.warning != undefined && (
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
              <Stack direction="row" gap={1}>
                {(selectedSource?.docsLinks ?? []).map((item) => (
                  <Link
                    key={item.url}
                    color="primary"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label ? `View docs for ${item.label}` : "View docs"}
                  </Link>
                ))}
              </Stack>
            </Stack>
          </form>
        </Stack>
      </Stack>
    </View>
  );
}
