// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReOrderDotsVertical16Filled } from "@fluentui/react-icons";
import { Fade, ListItem, ListItemButton, ListItemText, Tooltip, Typography } from "@mui/material";
import { useCallback, useEffect, useRef } from "react";
import { useDrag } from "react-dnd";
import { MosaicDragType, MosaicPath } from "react-mosaic-component";
import { MosaicDropTargetPosition } from "react-mosaic-component/lib/internalTypes";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import TextHighlight from "@foxglove/studio-base/components/TextHighlight";
import { PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import { MosaicDropResult, PanelConfig, SavedProps } from "@foxglove/studio-base/types/panels";

const useStyles = makeStyles<void, "dragIcon">()((theme, _params, classes) => {
  return {
    listItemButton: {
      height: theme.spacing(4), // hard coded here because the parent element of this changes based on context
      cursor: "grab",

      [`&:not(:hover) .${classes.dragIcon}`]: {
        visibility: "hidden",
      },
    },
    dragIcon: {
      cursor: "grab",
      marginRight: theme.spacing(-1),
      color: theme.palette.text.disabled,
    },
  };
});

export type DropDescription = {
  type: string;
  config?: PanelConfig;
  relatedConfigs?: SavedProps;
  position?: MosaicDropTargetPosition;
  path?: MosaicPath;
  tabId?: string;
};

type Props = {
  panel: PanelInfo;
  searchQuery: string;
  checked?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  mosaicId: string;
  onDragStart?: () => void;
  onDrop: (arg0: DropDescription) => void;
};

export function PanelListItem(props: Props): JSX.Element {
  const {
    searchQuery,
    panel,
    onClick,
    onDragStart,
    onDrop,
    checked = false,
    highlighted = false,
    mosaicId,
  } = props;
  const { classes } = useStyles();
  const scrollRef = useRef<HTMLElement>(ReactNull);
  const [, connectDragSource] = useDrag<unknown, MosaicDropResult, never>({
    type: MosaicDragType.WINDOW,
    // mosaicId is needed for react-mosaic to accept the drop
    item: () => {
      onDragStart?.();
      return { mosaicId };
    },
    options: { dropEffect: "copy" },
    end: (_item, monitor) => {
      const dropResult = monitor.getDropResult() ?? {};
      const { position, path, tabId } = dropResult;
      // dropping outside mosaic does nothing. If we have a tabId, but no
      // position or path, we're dragging into an empty tab.
      if ((position == undefined || path == undefined) && tabId == undefined) {
        // when dragging a panel into an empty layout treat it link clicking the panel
        // mosaic doesn't give us a position or path to invoke onDrop
        onClick();
        return;
      }
      const { type, config, relatedConfigs } = panel;
      onDrop({ type, config, relatedConfigs, position, path, tabId });
    },
  });

  useEffect(() => {
    if (highlighted && scrollRef.current) {
      const highlightedItem = scrollRef.current.getBoundingClientRect();
      const scrollContainer = scrollRef.current.parentElement?.parentElement?.parentElement;
      if (scrollContainer) {
        const scrollContainerToTop = scrollContainer.getBoundingClientRect().top;

        const isInView =
          highlightedItem.top >= 0 &&
          highlightedItem.top >= scrollContainerToTop &&
          highlightedItem.top + 50 <= window.innerHeight;

        if (!isInView) {
          scrollRef.current.scrollIntoView();
        }
      }
    }
  }, [highlighted]);

  const mergedRef = useCallback(
    (el: HTMLElement | ReactNull) => {
      connectDragSource(el);
      scrollRef.current = el;
    },
    [connectDragSource, scrollRef],
  );

  const targetString = panel.extensionNamespace
    ? `${panel.title} [${panel.extensionNamespace}]`
    : panel.title;

  const onClickWithStopPropagation = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onClick();
    },
    [onClick],
  );

  return (
    <Tooltip
      placement="right"
      enterDelay={500}
      leaveDelay={0}
      TransitionComponent={Fade}
      title={
        <Stack paddingTop={0.25} style={{ width: 200 }}>
          {panel.thumbnail != undefined && <img src={panel.thumbnail} alt={panel.title} />}
          <Stack padding={1} gap={0.5}>
            <Typography variant="body2" fontWeight="bold">
              {panel.title}
            </Typography>
            <Typography variant="body2" style={{ opacity: 0.6 }}>
              {panel.description}
            </Typography>
          </Stack>
        </Stack>
      }
    >
      <ListItem dense disablePadding>
        <ListItemButton
          selected={highlighted}
          className={classes.listItemButton}
          disabled={checked}
          ref={mergedRef}
          onClick={onClickWithStopPropagation}
        >
          <ListItemText>
            <span data-testid={`panel-menu-item ${panel.title}`}>
              <TextHighlight targetStr={targetString} searchText={searchQuery} />
            </span>
          </ListItemText>

          <ReOrderDotsVertical16Filled className={classes.dragIcon} />
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
}
