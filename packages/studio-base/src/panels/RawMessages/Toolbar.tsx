// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import DiffIcon from "@mui/icons-material/Difference";
import DiffOutlinedIcon from "@mui/icons-material/DifferenceOutlined";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { IconButton, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { Topic } from "@foxglove/studio";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { Constants, RawMessagesPanelConfig } from "./types";

type Props = {
  canExpandAll: boolean;
  diffEnabled: boolean;
  diffMethod: RawMessagesPanelConfig["diffMethod"];
  diffTopicPath: string;
  onDiffTopicPathChange: (path: string) => void;
  onToggleDiff: () => void;
  onToggleExpandAll: () => void;
  onTopicPathChange: (path: string) => void;
  saveConfig: SaveConfig<RawMessagesPanelConfig>;
  topic?: Topic;
  topicPath: string;
};

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    paddingBlock: 0,
    gap: theme.spacing(0.25),
  },
  iconButton: {
    padding: theme.spacing(0.25),

    "&.Mui-selected": {
      color: theme.palette.primary.main,
      backgroundColor: theme.palette.action.selected,
    },
  },
  diffOptions: {
    borderTop: `1px solid ${theme.palette.background.default}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(0.25, 0.75),
    paddingInlineEnd: theme.spacing(6.75),
    gap: theme.spacing(0.25),
    display: "flex",
  },
}));

function ToolbarComponent(props: Props): JSX.Element {
  const {
    canExpandAll,
    diffEnabled,
    diffMethod,
    diffTopicPath,
    onDiffTopicPathChange,
    onToggleDiff,
    onToggleExpandAll,
    onTopicPathChange,
    saveConfig,
    topic,
    topicPath,
  } = props;

  const { classes, cx } = useStyles();

  return (
    <>
      <PanelToolbar className={classes.toolbar}>
        <IconButton
          className={cx(classes.iconButton, { "Mui-selected": diffEnabled })}
          title="Toggle diff"
          onClick={onToggleDiff}
          color={diffEnabled ? "default" : "inherit"}
          size="small"
        >
          {diffEnabled ? <DiffIcon fontSize="small" /> : <DiffOutlinedIcon fontSize="small" />}
        </IconButton>
        <IconButton
          className={classes.iconButton}
          title={canExpandAll ? "Expand all" : "Collapse all"}
          onClick={onToggleExpandAll}
          data-testid="expand-all"
          size="small"
        >
          {canExpandAll ? <UnfoldMoreIcon fontSize="small" /> : <UnfoldLessIcon fontSize="small" />}
        </IconButton>
        <Stack fullWidth paddingLeft={0.25}>
          <MessagePathInput
            index={0}
            path={topicPath}
            onChange={onTopicPathChange}
            inputStyle={{ height: 20 }}
          />
        </Stack>
      </PanelToolbar>
      {diffEnabled && (
        <div className={classes.diffOptions}>
          <Select
            variant="filled"
            size="small"
            title="Diff method"
            value={diffMethod}
            MenuProps={{ MenuListProps: { dense: true } }}
            onChange={(event: SelectChangeEvent) => {
              saveConfig({
                diffMethod: event.target.value as RawMessagesPanelConfig["diffMethod"],
              });
            }}
          >
            <MenuItem value={Constants.PREV_MSG_METHOD}>{Constants.PREV_MSG_METHOD}</MenuItem>
            <MenuItem value={Constants.CUSTOM_METHOD}>custom</MenuItem>
          </Select>
          {diffMethod === Constants.CUSTOM_METHOD && (
            <MessagePathInput
              index={1}
              path={diffTopicPath}
              onChange={onDiffTopicPathChange}
              {...(topic ? { prioritizedDatatype: topic.schemaName } : {})}
            />
          )}
        </div>
      )}
    </>
  );
}

export const Toolbar = React.memo(ToolbarComponent);
