import { PropsWithChildren } from "react";
import { AppParametersInput } from "@lichtblick/suite-base/context/AppParametersContext";
/**
 * AppParametersProviderのプロパティ型定義
 */
type Props = PropsWithChildren<{
    /** アプリケーションパラメータの入力値（オプション） */
    appParameters?: AppParametersInput;
}>;
/**
 * AppParametersProvider
 *
 * アプリケーション全体で使用されるパラメータを管理するProviderコンポーネントです。
 * アプリケーションの初期化時に設定されたパラメータを子コンポーネントに提供します。
 *
 * ## 主な機能
 * - アプリケーション設定パラメータの中央管理
 * - 型安全なパラメータアクセスの提供
 * - パラメータの自動補完とバリデーション
 * - 設定値の一元化による保守性向上
 *
 * ## 使用場面
 * - アプリケーションの初期設定値の管理
 * - デバッグモードやフィーチャーフラグの制御
 * - 環境固有の設定値の管理
 * - プラットフォーム固有のパラメータ設定
 *
 * ## 型安全性
 * `appParameters`入力は`AppParameters`型にキャストされ、
 * キーが期待される列挙型と一致することを保証します。
 * これにより、開発者に適切な自動補完と型チェックを提供します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.children - 子コンポーネント
 * @param props.appParameters - アプリケーションパラメータ（デフォルト: 空オブジェクト）
 * @returns React.JSX.Element
 *
 * @example
 * ```typescript
 * // アプリケーションルートでの使用
 * const appParams = {
 *   debugMode: true,
 *   theme: 'dark',
 *   enableExperimentalFeatures: false
 * };
 *
 * <AppParametersProvider appParameters={appParams}>
 *   <App />
 * </AppParametersProvider>
 *
 * // 子コンポーネントでの使用
 * const parameters = useContext(AppParametersContext);
 * const debugMode = parameters.debugMode; // 型安全なアクセス
 * ```
 */
export default function AppParametersProvider({ children, appParameters, }: Props): React.JSX.Element;
export {};
