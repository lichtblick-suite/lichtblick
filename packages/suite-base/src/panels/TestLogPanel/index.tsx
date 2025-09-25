// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Test panel for demonstrating log functionality
import { Button, Typography } from "@mui/material";
import { useCallback, useContext, useState } from "react";

import Panel from "@lichtblick/suite-base/components/Panel";
import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

type Config = {
  errorCount: number;
};

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

function TestLogPanel(props: Props) {
  const { config, saveConfig } = props;
  const [renderCount, setRenderCount] = useState(0);
  const panelContext = useContext(PanelContext);
  const { logError } = panelContext ?? {};

  const throwError = useCallback(() => {
    try {
      throw new Error(`Test error #${config.errorCount + 1}: Something went wrong!`);
    } catch (error) {
      if (logError && error instanceof Error) {
        logError(`Button click error`, error);
        saveConfig({ errorCount: config.errorCount + 1 });
      }
    }
  }, [config.errorCount, logError, saveConfig]);

  const throwAsyncError = useCallback(async () => {
    try {
      await new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Async test error #${config.errorCount + 1}: Async operation failed!`));
        }, 100);
      });
    } catch (error) {
      if (logError && error instanceof Error) {
        logError(`Async operation error`, error);
        saveConfig({ errorCount: config.errorCount + 1 });
      }
    }
  }, [config.errorCount, logError, saveConfig]);

  const causeRenderError = useCallback(() => {
    setRenderCount(renderCount + 1);
    saveConfig({ errorCount: config.errorCount + 1 });
  }, [config.errorCount, renderCount, saveConfig]);

  if (renderCount > 2) {
    throw new Error(`Render error #${config.errorCount}: Too many renders!`);
  }

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack padding={2} gap={2} alignItems="flex-start">
        <Typography variant="h6">Test Log Panel</Typography>
        <Typography variant="body2" color="text.secondary">
          Use the buttons below to trigger different types of errors that should appear in the panel
          logs. Click the logs button (📋) in the toolbar to view them.
        </Typography>

        <Typography variant="body2">Error count: {config.errorCount}</Typography>

        <Button variant="contained" color="error" onClick={throwError}>
          Throw Synchronous Error
        </Button>

        <Button variant="contained" color="warning" onClick={throwAsyncError}>
          Throw Async Error
        </Button>

        <Button variant="contained" color="secondary" onClick={causeRenderError}>
          Cause Render Error (render count: {renderCount})
        </Button>

        <Button
          variant="contained"
          color="info"
          onClick={() => {
            if (logError) {
              logError(`Manual log entry #${config.errorCount + 1}: This is a test log message`);
              saveConfig({ errorCount: config.errorCount + 1 });
            }
          }}
        >
          Log Message (No Error)
        </Button>

        <Button
          variant="outlined"
          onClick={() => {
            setRenderCount(0);
          }}
        >
          Reset Render Count
        </Button>

        <Button
          variant="outlined"
          onClick={() => {
            saveConfig({ errorCount: 0 });
          }}
        >
          Reset Error Count
        </Button>
      </Stack>
    </Stack>
  );
}

const defaultConfig: Config = {
  errorCount: 0,
};

export default Panel(
  Object.assign(TestLogPanel, {
    panelType: "TestLogPanel",
    defaultConfig,
  }),
);
