// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Menu, MenuItem, MenuItemProps, MenuProps } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "react-use";

import { DraggedMessagePath } from "@foxglove/studio-base/components/PanelExtensionAdapter";

export function ContextMenu(props: {
  messagePaths: DraggedMessagePath[];
  anchorPosition: NonNullable<MenuProps["anchorPosition"]>;
  onClose: () => void;
}): JSX.Element {
  const { messagePaths, anchorPosition, onClose } = props;
  const [, copyToClipboard] = useCopyToClipboard();
  const { t } = useTranslation("topicList");

  const menuItems = useMemo(() => {
    const hasNonTopicItems = messagePaths.some((item) => !item.isTopic);
    const items: MenuItemProps[] = [
      {
        children: hasNonTopicItems
          ? messagePaths.length === 1
            ? t("copyMessagePath")
            : t("copyMessagePaths")
          : messagePaths.length === 1
          ? t("copyTopicName")
          : t("copyTopicNames"),
        onClick: () => {
          onClose();
          copyToClipboard(messagePaths.map((item) => item.path).join("\n"));
        },
      },
    ];
    if (messagePaths.length === 1 && messagePaths[0]?.isTopic === true) {
      items.push({
        children: t("copySchemaName"),
        onClick: () => {
          const schemaName = messagePaths[0]?.rootSchemaName;
          if (schemaName != undefined) {
            onClose();
            copyToClipboard(schemaName);
          }
        },
      });
    }
    return items;
  }, [t, onClose, copyToClipboard, messagePaths]);

  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      MenuListProps={{
        dense: true,
      }}
    >
      {menuItems.map((item, index) => (
        <MenuItem key={index} {...item} />
      ))}
    </Menu>
  );
}
