import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { TopicListItem } from "@lichtblick/suite-base/components/TopicList/useTopicListSearch";
/**
 * getDraggedMessagePath - TopicListアイテムをドラッグ可能なメッセージパスに変換
 *
 * @description
 * この関数は、TopicListで表示されるアイテム（トピックまたはメッセージパス）を
 * ドラッグ&ドロップ操作で使用するDraggedMessagePath形式に変換します。
 *
 * **変換処理:**
 * - **トピック項目**: トピック名をクォートし、基本的なメタデータを設定
 * - **スキーマ項目**: フルパスとリーフ情報を含む詳細なメタデータを設定
 *
 * **出力形式:**
 * ```typescript
 * // トピック項目の場合
 * {
 *   path: "/quoted_topic_name",
 *   rootSchemaName: "nav_msgs/Odometry",
 *   isTopic: true,
 *   isLeaf: false,
 *   topicName: "/odom"
 * }
 *
 * // メッセージパス項目の場合
 * {
 *   path: "/odom.pose.position.x",
 *   rootSchemaName: "nav_msgs/Odometry",
 *   isTopic: false,
 *   isLeaf: true,
 *   topicName: "/odom"
 * }
 * ```
 *
 * **使用場面:**
 * - ドラッグ&ドロップ操作の開始時
 * - コンテキストメニューでの選択アイテム処理
 * - パネルへのアイテム追加処理
 *
 * **依存関係:**
 * - quoteTopicNameIfNeeded: トピック名の適切なクォート処理
 * - DraggedMessagePath: ドラッグアイテムの型定義
 * - TopicListItem: 入力アイテムの型定義
 *
 * @param treeItem - 変換対象のTopicListアイテム
 * @returns ドラッグ&ドロップで使用可能なメッセージパス情報
 */
export declare function getDraggedMessagePath(treeItem: TopicListItem): DraggedMessagePath;
