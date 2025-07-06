/**
 * @fileoverview ROS データ型定義の拡張
 *
 * このファイルは、標準的なROSメッセージ定義を拡張し、
 * オプショナルフィールドをサポートするための型定義を提供します。
 *
 * ROSメッセージの動的な解析と型安全な操作を可能にします。
 */
import { MessageDefinition, MessageDefinitionField } from "@lichtblick/message-definition";
/**
 * オプショナルフィールドを持つメッセージ定義フィールド
 *
 * @description 標準的なROSメッセージ定義フィールドを拡張し、
 * フィールドがオプショナルかどうかを示すフラグを追加します。
 *
 * これにより、必須フィールドと任意フィールドを区別でき、
 * より柔軟なメッセージ処理が可能になります。
 */
type OptionalMessageDefinitionField = MessageDefinitionField & {
    /** フィールドがオプショナルかどうかを示すフラグ */
    optional?: boolean;
};
/**
 * オプショナルフィールドをサポートするメッセージ定義
 *
 * @description 標準的なROSメッセージ定義を拡張し、
 * オプショナルフィールドの情報を含むメッセージ定義を表現します。
 *
 * 用途:
 * - 動的なメッセージ解析
 * - 型安全なメッセージ処理
 * - メッセージバリデーション
 * - スキーマ進化への対応
 */
export type OptionalMessageDefinition = MessageDefinition & {
    /** オプショナルフィールド情報を含むフィールド定義の配列 */
    definitions: OptionalMessageDefinitionField[];
};
/**
 * ROSデータ型のマッピング
 *
 * @description データ型名からそのデータ型定義へのマッピングを提供します。
 *
 * このマップは以下の用途で使用されます:
 * - メッセージの動的解析
 * - 型情報の実行時検索
 * - メッセージのシリアライゼーション/デシリアライゼーション
 * - スキーマ検証
 *
 * @example
 * ```typescript
 * const datatypes: RosDatatypes = new Map([
 *   ['geometry_msgs/Point', {
 *     name: 'geometry_msgs/Point',
 *     definitions: [
 *       { name: 'x', type: 'float64', isArray: false },
 *       { name: 'y', type: 'float64', isArray: false },
 *       { name: 'z', type: 'float64', isArray: false }
 *     ]
 *   }]
 * ]);
 * ```
 */
export type RosDatatypes = Map<string, OptionalMessageDefinition>;
export {};
