// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ErrorCircle16Regular, Info16Regular, Warning16Regular } from "@fluentui/react-icons";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Typography,
  accordionSummaryClasses,
  useTheme,
} from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { DetailsType, NotificationSeverity } from "@foxglove/studio-base/util/sendNotification";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles()((theme) => ({
  acccordion: {
    background: "none",
    boxShadow: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,

    "&:before": {
      display: "none",
    },
    "&.Mui-expanded": {
      margin: 0,
    },
  },
  accordionDetails: {
    display: "flex",
    flexDirection: "column",
    fontFamily: fonts.MONOSPACE,
    fontSize: "0.6875rem",
    padding: theme.spacing(1.125),
    gap: theme.spacing(1),
  },
  acccordionSummary: {
    height: 30,
    minHeight: "auto",
    padding: theme.spacing(0, 0.5, 0, 0.75),
    fontWeight: 500,

    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&.Mui-expanded": {
      minHeight: "auto",
    },
    [`& .${accordionSummaryClasses.content}`]: {
      gap: theme.spacing(0.5),
      overflow: "hidden",
      alignItems: "center",
      margin: "0 !important",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}`]: {
      transform: "rotate(-90deg)",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}.Mui-expanded`]: {
      transform: "rotate(0deg)",
    },
  },
  detailsText: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    maxHeight: "30vh",
    overflow: "auto",
    flex: 1,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(1),
  },
  icon: {
    flex: "none",
  },
}));

const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;

function ProblemIcon({ severity }: { severity: NotificationSeverity }): JSX.Element {
  const { palette } = useTheme();
  const { classes } = useStyles();

  switch (severity) {
    case "warn":
      return <Warning16Regular className={classes.icon} primaryFill={palette.warning.main} />;
    case "error":
      return <ErrorCircle16Regular className={classes.icon} primaryFill={palette.error.main} />;
    case "info":
      return <Info16Regular className={classes.icon} primaryFill={palette.info.main} />;
    default:
      return <></>;
  }
}

function ProblemDetails(props: { details: DetailsType; tip?: string }): JSX.Element {
  const { t } = useTranslation("problemsList");
  const { details, tip } = props;
  const { classes } = useStyles();

  const content = useMemo(() => {
    if (details instanceof Error) {
      return <div className={classes.detailsText}>{details.message}</div>;
    } else if (details != undefined && details !== "") {
      return (
        <Typography style={{ whiteSpace: "pre-line" /* allow newlines in the details message */ }}>
          {details}
        </Typography>
      );
    } else if (tip != undefined && tip !== "") {
      return undefined;
    }

    return t("noDetailsProvided");
  }, [classes, details, tip, t]);

  return (
    <AccordionDetails className={classes.accordionDetails}>
      {tip && <div>{tip}</div>}
      {content}
    </AccordionDetails>
  );
}

export function ProblemsList(): JSX.Element {
  const { t } = useTranslation("problemsList");
  const { classes } = useStyles();
  const playerProblems = useMessagePipeline(selectPlayerProblems);

  if (playerProblems == undefined || playerProblems.length === 0) {
    return <EmptyState>{t("noProblemsFound")}</EmptyState>;
  }

  return (
    <Stack fullHeight flex="auto" overflow="auto">
      {playerProblems.map((problem, idx) => (
        <Accordion
          className={classes.acccordion}
          key={`${idx}.${problem.severity}.${problem.message}`}
          TransitionProps={{ unmountOnExit: true }}
          defaultExpanded
        >
          <AccordionSummary
            className={classes.acccordionSummary}
            expandIcon={<ArrowDropDownIcon />}
            title={problem.message}
          >
            <ProblemIcon severity={problem.severity} />
            <Typography variant="inherit" noWrap>
              {problem.message}
            </Typography>
          </AccordionSummary>
          <Divider />
          <ProblemDetails details={problem.error} tip={problem.tip} />
        </Accordion>
      ))}
    </Stack>
  );
}
