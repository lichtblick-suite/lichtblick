// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { quoteTopicNameIfNeeded } from "@lichtblick/message-path";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { TopicListItem } from "@lichtblick/suite-base/components/TopicList/useTopicListSearch";

export function getDraggedMessagePath(treeItem: TopicListItem): DraggedMessagePath {
  switch (treeItem.type) {
    case "topic":
      return {
        path: quoteTopicNameIfNeeded(treeItem.item.item.name),
        rootSchemaName: treeItem.item.item.schemaName,
        isTopic: true,
        isLeaf: false,
        topicName: treeItem.item.item.name,
      };
    case "schema":
      return {
        path: treeItem.item.item.fullPath,
        rootSchemaName: treeItem.item.item.topic.schemaName,
        isTopic: false,
        isLeaf: treeItem.item.item.suffix.isLeaf,
        topicName: treeItem.item.item.topic.name,
      };
  }
}
