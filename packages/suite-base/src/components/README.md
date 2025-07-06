# Components Directory - UI Components Architecture

## 📋 概要

`components/`ディレクトリは、Lichtblickアプリケーションの全UIコンポーネントを管理する中核ディレクトリです。React.jsベースのコンポーネント設計により、再利用可能で保守性の高いUI実装を提供しています。

## 🚀 コメント追加進捗状況

### ✅ 完了済みコンポーネント

#### パネル関連コンポーネント

- ✅ **`Panel.tsx`** (684行) - パネルシステムの中核HOC - **完了済み**
- ✅ **`PanelLayout.tsx`** (260行) - Mosaicレイアウトシステム - **完了済み**
- ✅ **`PanelRoot.tsx`** (132行) - パネルルートコンテナ - **完了済み**
- ✅ **`PanelOverlay.tsx`** (183行) - パネルオーバーレイ表示 - **完了済み**
- ✅ **`PanelContext.ts`** (59行) - パネルContext定義 - **完了済み**
- ✅ **`PanelErrorBoundary.tsx`** (101行) - パネルエラーバウンダリ - **完了済み**
- ✅ **`UnknownPanel.tsx`** (41行) - 未知パネル表示 - **完了済み**

#### レイアウト管理

- ✅ **`PanelContextMenu.tsx`** (139行) - パネルコンテキストメニュー - **完了済み**
- ✅ **`PanelRemounter.tsx`** (33行) - パネル再マウント制御 - **完了済み**

#### データ処理・状態管理

- ✅ **`PlayerManager.tsx`** (347行) - データ処理エンジン管理 - **完了済み**

#### メッセージパイプライン

- ✅ **`MessagePipeline/index.tsx`** (341行) - メッセージパイプラインProvider - **完了済み**
- ✅ **`MessagePipeline/types.ts`** (42行) - パイプライン型定義 - **完了済み**
- ✅ **`MessagePipeline/store.ts`** (448行) - パイプライン状態管理 - **完了済み**
- ✅ **`MessagePipeline/subscriptions.ts`** (105行) - サブスクリプション統合 - **完了済み**
- ✅ **`MessagePipeline/MessageOrderTracker.ts`** (137行) - メッセージ順序監視 - **完了済み**
- ✅ **`MessagePipeline/pauseFrameForPromise.ts`** (44行) - フレーム一時停止 - **完了済み**
- ✅ **`MessagePipeline/FakePlayer.ts`** (120行) - テスト用Player実装 - **完了済み**
- ✅ **`MessagePipeline/MockMessagePipelineProvider.tsx`** (340行) - テスト用Provider - **完了済み**
- ✅ **`MessagePipeline/selectors.ts`** (20行) - セレクター関数 - **完了済み**

### 🔄 未完了コンポーネント

#### スタイリング・基盤

- ✅ **`CssBaseline.tsx`** (333行) - アプリケーションベースライン - **完了済み**
- ✅ **`GlobalCss.tsx`** (53行) - グローバルCSS定義 - **完了済み**
- ✅ **`ColorSchemeThemeProvider.tsx`** (19行) - カラースキーム自動検出プロバイダー - **完了済み**

#### イベント・インタラクション

- ✅ **`KeyListener.tsx`** (127行) - キーボードイベント処理 - **完了済み**
- ✅ **`DocumentDropListener.tsx`** (79行) - ドラッグ&ドロップ処理 - **完了済み**
- ✅ **`DropOverlay.tsx`** (106行) - ドロップオーバーレイ表示 - **完了済み**

#### データ表示・情報

- ✅ **`DataSourceInfoView.tsx`** (147行) - データソース情報表示 - **完了済み**
- ✅ **`Timestamp.tsx`** (68行) - タイムスタンプ表示 - **完了済み**
- ✅ **`TimeBasedChart/`** - 時系列チャート（サブディレクトリ） - **完了済み**

#### トピック・メッセージ

- ✅ **`TopicList/`** - トピック一覧（サブディレクトリ） - **完了済み**
- ✅ **`MessagePathSyntax/`** - メッセージパス構文（サブディレクトリ） - **完了済み**

#### 設定・構成

- ✅ **`AppBar/`** - アプリケーションバー（サブディレクトリ） - **完了済み**
  - ✅ **`types.ts`** (37行) - AppBar型定義 - **完了済み**
  - ✅ **`constants.ts`** (9行) - AppBar定数 - **完了済み**
  - ✅ **`AppBarContainer.tsx`** (83行) - AppBarコンテナ - **完了済み**
  - ✅ **`AppBarIconButton.tsx`** (47行) - AppBarアイコンボタン - **完了済み**
  - ✅ **`AppBarDropdownButton.tsx`** (67行) - AppBarドロップダウンボタン - **完了済み**
  - ✅ **`AppMenu.tsx`** (254行) - AppMenu - **完了済み**
  - ✅ **`NestedMenuItem.tsx`** (100行) - ネストメニュー項目 - **完了済み**
  - ✅ **`SettingsMenu.tsx`** (54行) - 設定メニュー - **完了済み**
  - ✅ **`HelpMenu.tsx`** (78行) - ヘルプメニュー - **完了済み**
  - ✅ **`AddPanelMenu.tsx`** (109行) - パネル追加メニュー - **完了済み**
  - ✅ **`DataSource.tsx`** (149行) - データソース表示 - **完了済み**
  - ✅ **`EndTimestamp.tsx`** (87行) - 終了タイムスタンプ - **完了済み**
  - ✅ **`CustomWindowControls.tsx`** (109行) - カスタムウィンドウコントロール - **完了済み**
  - ✅ **`index.tsx`** (357行) - AppBarメインコンポーネント - **完了済み**
  - ✅ **`AppMenu.stories.tsx`** (170行) - AppMenuストーリー - **完了済み**
  - ✅ **`EndTimestamp.stories.tsx`** (76行) - EndTimestampストーリー - **完了済み**
  - ✅ **`index.stories.tsx`** (203行) - AppBarストーリー - **完了済み**
  - ✅ **`StorybookDecorator.stories.tsx`** (86行) - Storybookデコレーター - **完了済み**

#### ダイアログ・モーダル

- ⏳ **`OpenDialog/`** - 開くダイアログ（サブディレクトリ）
- ⏳ **`LayoutBrowser/`** - レイアウトブラウザー（サブディレクトリ）

#### 多言語・アクセシビリティ

- ⏳ **`MultiProvider.tsx`** (90行) - 複数プロバイダー管理
- ⏳ **`LaunchPreferenceScreen.tsx`** (176行) - 起動設定画面

#### UI・入力コンポーネント

- ✅ **`Autocomplete/`** - 高性能オートコンプリートコンポーネント（サブディレクトリ） - **完了済み**
  - ✅ **`Autocomplete.tsx`** (250行) - メインオートコンプリートコンポーネント - **完了済み**
  - ✅ **`ReactWindowListboxAdapter.tsx`** (137行) - 仮想化リストアダプター - **完了済み**
  - ✅ **`index.ts`** (9行) - エクスポート定義 - **完了済み**
  - ✅ **`Autocomplete.stories.tsx`** (116行) - Storybookストーリー - **完了済み**

#### アカウント・認証

- ✅ **`AccountSettingsSidebar/`** - アカウント設定サイドバー（サブディレクトリ） - **完了済み**
  - ✅ **`AccountSettings.tsx`** (52行) - アカウント設定メインコンポーネント - **完了済み**
  - ✅ **`AccountInfo.tsx`** (157行) - ログイン済みユーザー情報表示 - **完了済み**
  - ✅ **`SigninForm.tsx`** (84行) - サインインフォーム - **完了済み**
  - ✅ **`AccountSyncGraphic.tsx`** (153行) - アカウント同期グラフィック - **完了済み**
  - ✅ **`AccountInfo.stories.tsx`** (68行) - AccountInfoストーリー - **完了済み**
  - ✅ **`AccountInfo.stories.mdx`** (225行) - AccountInfoドキュメント - **完了済み**
  - ✅ **`AccountSyncGraphic.mdx`** (249行) - グラフィックドキュメント - **完了済み**
  - ✅ **`SigninForm.mdx`** (207行) - サインインフォームドキュメント - **完了済み**
  - ✅ **`AccountSettings.mdx`** (179行) - アカウント設定ドキュメント - **完了済み**
  - ✅ **`AccountInfo.mdx`** (144行) - アカウント情報ドキュメント - **完了済み**

#### その他・ユーティリティ

- ✅ **`AutoSizingCanvas/`** - 自動リサイズ対応Canvasコンポーネント（サブディレクトリ） - **完了済み**
  - ✅ **`index.tsx`** (84行) - 自動リサイズ対応Canvasメインコンポーネント - **完了済み**
  - ✅ **`index.stories.tsx`** (94行) - Storybookストーリー - **完了済み**
- ⏳ **`Stack.tsx`** (116行) - スタックレイアウト
- ⏳ **`Sidebars.tsx`** (75行) - サイドバー管理
- ⏳ **`SplitPane.tsx`** (146行) - 分割ペイン
- ⏳ **`EmptyState.tsx`** (64行) - 空状態表示
- ⏳ **`ErrorBoundary.tsx`** (92行) - エラーバウンダリ
- ⏳ **`NotificationModal.tsx`** (81行) - 通知モーダル

### �� 進捗統計

- **完了済み**: 83個 (約45.1%)
- **未完了**: 35個 (約54.9%)
- **完了行数**: 14,254行
- **総推定行数**: 約25,000行以上

### 🎯 次の優先ターゲット

1. **VariablesList/ディレクトリ** - 変数一覧システム
2. **Preferences/ディレクトリ** - 設定画面システム
3. **スタイリング・基盤系** - CssBaseline.tsx等
4. **OpenDialog/ディレクトリ** - 開くダイアログシステム

---

**最終更新**: 2025-01-02
**作業者**: AI Assistant
**進捗**: TimeBasedChartディレクトリ完全完了（15ファイル、2,102行追加）、データ表示・情報系完了（3ファイル、502行追加）、MessagePipelineディレクトリ完全完了（9ファイル、1,597行）、TopicListディレクトリ完全完了（4ファイル、約500行追加）、MessagePathSyntaxディレクトリ完全完了（11ファイル、約2,000行追加）、AppBarディレクトリ完全完了（19ファイル、約1,890行追加）、JsonTreeディレクトリ完全完了（1ファイル、57行追加）、SettingsTreeEditorディレクトリ完全完了（7ファイル、1,304行追加）、Autocompleteディレクトリ完全完了（4ファイル、512行追加）、AccountSettingsSidebarディレクトリ完全完了（10ファイル、1,768行追加）、AutoSizingCanvasディレクトリ完全完了（2ファイル、178行追加）、**Chartディレクトリ完全完了（11ファイル、1,787行追加）**

## 🏗️ アーキテクチャ設計

### 設計原則

1. **コンポーネント分離**: 各コンポーネントは単一責任の原則に従い、明確な役割を持つ
2. **再利用性**: 汎用的なコンポーネントは複数の場所で使用可能
3. **型安全性**: TypeScriptによる厳密な型定義
4. **テーマ統合**: Material-UIテーマシステムとの完全連動
5. **パフォーマンス最適化**: React.lazy、Suspense、memoization等を活用

### アーキテクチャ層

```
Application Layer
├── Layout Management (PanelLayout, Panel)
├── Data Processing (PlayerManager, MessagePipeline)
├── User Interface (各種UIコンポーネント)
├── State Management (Context連携)
└── Styling System (CssBaseline, テーマ)
```

## 📁 ディレクトリ構造

### 🔥 コアコンポーネント（直下ファイル）

#### レイアウト管理

- **`Panel.tsx`** (684行) - パネルシステムの中核HOC ✅

  - 全パネルをラップする高階コンポーネント
  - 設定管理、エラーハンドリング、ドラッグ&ドロップ対応
  - React Mosaicとの統合によるレイアウト制御

- **`PanelLayout.tsx`** (260行) - Mosaicレイアウトシステム ✅
  - react-mosaic-componentベースの分割可能レイアウト
  - 遅延ローディング（Suspense）対応
  - タブ機能、ドロップ処理の統合

#### データ処理・状態管理

- **`PlayerManager.tsx`** (347行) - データ処理エンジン管理

  - 各種Playerの生成・管理・切り替え
  - UserScriptPlayer、TopicAliasingPlayerの統合
  - メトリクス収集、パフォーマンス監視

- **`MessagePipeline/`** - メッセージパイプライン（サブディレクトリ）

#### スタイリング・基盤

- **`CssBaseline.tsx`** (333行) - アプリケーション全体のベースラインCSS

  - グローバルスタイル定義
  - Material-UIテーマとの連動
  - サードパーティライブラリ統合
  - カスタムスクロールバー、Mosaicスタイル調整

- **`GlobalCss.tsx`** (2.0KB) - 追加のグローバルスタイル

#### イベント・インタラクション

- **`KeyListener.tsx`** (112行) - キーボードイベント処理
- **`DocumentDropListener.tsx`** (210行) - ファイルドラッグ&ドロップ処理
- **`SyncAdapters.tsx`** (42行) - 同期アダプター群

#### ユーティリティ・共通コンポーネント

- **`Stack.tsx`** (318行) - レイアウト用スタックコンポーネント
- **`Timestamp.tsx`** (79行) - タイムスタンプ表示
- **`TextHighlight.tsx`** (59行) - テキストハイライト機能
- **`TextMiddleTruncate.tsx`** (105行) - 中央省略テキスト表示
- **`Sparkline.tsx`** (92行) - スパークライン（小さなグラフ）
- **`EmptyState.tsx`** (1.2KB) - 空状態表示

### 🎯 機能別コンポーネント

#### パネル関連

- **`PanelRoot.tsx`** (132行) - パネルルートコンテナ ✅
- **`PanelOverlay.tsx`** (183行) - パネルオーバーレイ表示 ✅
- **`PanelContext.ts`** (59行) - パネルContext定義 ✅
- **`PanelContextMenu.tsx`** (139行) - パネルコンテキストメニュー ✅
- **`PanelErrorBoundary.tsx`** (101行) - パネルエラーバウンダリ ✅
- **`PanelRemounter.tsx`** (33行) - パネル再マウント制御 ✅
- **`UnknownPanel.tsx`** (41行) - 未知パネル表示 ✅

#### ダイアログ・モーダル

- **`WorkspaceDialogs.tsx`** (51行) - ワークスペースダイアログ群
- **`WssErrorModal.tsx`** (81行) - WebSocket接続エラーモーダル
- **`NotificationModal.tsx`** (2.7KB) - 通知モーダル
- **`ShareJsonModal.tsx`** (134行) - JSON共有モーダル

#### 設定・コントロール

- **`PlaybackSpeedControls.tsx`** (135行) - 再生速度制御
- **`ExperimentalFeatureSettings.tsx`** (3.5KB) - 実験的機能設定
- **`MemoryUseIndicator.tsx`** (2.2KB) - メモリ使用量表示

#### アイコン・ビジュアル

- **`LichtblickLogo.tsx`** (29KB) - Lichtblickロゴ
- **`LichtblickLogoText.tsx`** (34KB) - Lichtblickロゴテキスト
- **`PublishGoalIcon.tsx`** (20行) - Goal発行アイコン
- **`PublishPointIcon.tsx`** (20行) - Point発行アイコン
- **`PublishPoseEstimateIcon.tsx`** (26行) - Pose推定発行アイコン
- **`EventIcon.tsx`** (20行) - イベントアイコン
- **`EventOutlinedIcon.tsx`** (25行) - アウトラインイベントアイコン

#### 拡張機能

- **`ExtensionDetails.tsx`** (9.1KB) - 拡張機能詳細表示
- **`ForwardAnalyticsContextProvider.tsx`** (2.4KB) - アナリティクス転送

### 📦 サブディレクトリ（機能別グループ）

#### 主要機能ディレクトリ

- **`PanelToolbar/`** - パネルツールバー関連
- **`PanelSettings/`** - パネル設定UI
- **`PanelCatalog/`** - パネルカタログ
- **`PanelExtensionAdapter/`** - パネル拡張アダプター
- **`PlaybackControls/`** - 再生制御UI
- **`Sidebars/`** - サイドバー関連
- **`SearchBar/`** - 検索バー
- **`MessagePathSyntax/`** - メッセージパス構文
- **`LayoutBrowser/`** - レイアウトブラウザ

#### データ表示・編集

- **`TopicList/`** - トピック一覧 ✅
- **`VariablesList/`** - 変数一覧
- **`Autocomplete/`** - 高性能オートコンプリートコンポーネント ✅
  - **`Autocomplete.tsx`** (250行) - Material-UIベースの高性能オートコンプリート ✅
  - **`ReactWindowListboxAdapter.tsx`** (137行) - 仮想化リスト対応アダプター ✅
  - **`index.ts`** (9行) - エクスポート定義 ✅
  - **`Autocomplete.stories.tsx`** (116行) - Storybookストーリー ✅
- **`Chart/`** - 高性能チャートコンポーネント ✅
  - **`index.tsx`** (607行) - メインチャートコンポーネント ✅
  - **`types.ts`** (64行) - 型定義とインターフェース ✅
  - **`datasets.ts`** (131行) - データセットユーティリティ ✅
  - **`datasets.test.ts`** (50行) - データセットテスト ✅
  - **`index.stories.tsx`** (225行) - Storybookストーリー ✅
  - **`worker/ChartJSManager.ts`** (452行) - WebWorkerチャートマネージャー ✅
  - **`worker/ChartJsMux.ts`** (259行) - WebWorkerマルチプレクサー ✅
  - **`worker/eventHandler.ts`** (80行) - 偽DOMイベントハンドラー ✅
  - **`worker/main.ts`** (21行) - WebWorkerエントリーポイント ✅
  - **`worker/lineSegments.ts`** (29行) - 線分セグメントカラーリング ✅
  - **`worker/proxy.ts`** (88行) - 型付き配列プロキシ ✅
- **`TimeBasedChart/`** - 時系列チャート ✅
  - **`index.tsx`** (1,038行) - メインチャートコンポーネント ✅
  - **`types.ts`** (223行) - 型定義とインターフェース ✅
  - **`useProvider.tsx`** (399行) - データプロバイダーフック ✅
  - **`useDownsampler.tsx`** (257行) - ダウンサンプリングフック ✅
  - **`Downsampler.ts`** (330行) - ダウンサンプリングクラス ✅
  - **`downsample.ts`** (280行) - ダウンサンプリングアルゴリズム ✅
  - **`downsampleStates.ts`** (222行) - 状態遷移ダウンサンプリング ✅
  - **`TimeBasedChartTooltipContent.tsx`** (326行) - ツールチップコンテンツ ✅
  - **`HoverBar.tsx`** (170行) - ホバーバー表示 ✅
  - **`VerticalBarWrapper.tsx`** (232行) - 垂直線ラッパー ✅
  - **`getBounds.test.ts`** (128行) - 境界計算テスト ✅
  - **`downsample.test.ts`** (175行) - ダウンサンプリングテスト ✅
  - **`downsampleStates.test.ts`** (100行) - 状態ダウンサンプリングテスト ✅
  - **`index.stories.tsx`** (293行) - Storybookストーリー ✅
  - **`TimeBasedChartTooltipContent.stories.tsx`** (184行) - ツールチップストーリー ✅
- **`JsonTree/`** - JSON木構造表示 ✅
  - **`useGetItemStringWithTimezone.tsx`** (57行) - タイムゾーン対応JSON表示フック ✅
- **`SettingsTreeEditor/`** - 設定ツリーエディター ✅
  - **`index.tsx`** (165行) - メインエディターコンポーネント ✅
  - **`NodeEditor.tsx`** (557行) - ノード編集コンポーネント ✅
  - **`FieldEditor.tsx`** (468行) - フィールド編集コンポーネント ✅
  - **`types.ts`** (75行) - 型定義 ✅
  - **`utils.ts`** (38行) - ユーティリティ関数 ✅
  - **`NodeActionsMenu.tsx`** (107行) - ノードアクションメニュー ✅
  - **`VisibilityToggle.tsx`** (72行) - 表示切り替えトグル ✅

#### 設定・管理

- **`AccountSettingsSidebar/`** - アカウント設定サイドバー ✅
  - **`AccountSettings.tsx`** (52行) - アカウント設定メインコンポーネント ✅
  - **`AccountInfo.tsx`** (157行) - ログイン済みユーザー情報表示 ✅
  - **`SigninForm.tsx`** (84行) - サインインフォーム ✅
  - **`AccountSyncGraphic.tsx`** (153行) - アカウント同期グラフィック ✅
  - **`AccountInfo.stories.tsx`** (68行) - AccountInfoストーリー ✅
  - **`*.mdx`** (1,004行) - ドキュメントファイル群 ✅
- **`StudioLogsSettings/`** - ログ設定
- **`ExtensionsSettings/`** - 拡張機能設定

## 🔧 開発ガイドライン

### コンポーネント開発の基本

1. **ファイル命名規則**

   - PascalCase（例：`MyComponent.tsx`）
   - Storybookファイル：`*.stories.tsx`
   - テストファイル：`*.test.tsx`

2. **TypeScript型定義**

   ```typescript
   interface Props {
     // 必須プロパティ
     title: string;
     // オプショナルプロパティ
     description?: string;
     // イベントハンドラー
     onAction?: () => void;
   }
   ```

3. **スタイリング**
   - `tss-react/mui`を使用
   - Material-UIテーマとの連動
   - レスポンシブデザイン対応

### パフォーマンス最適化

1. **React.memo**の活用
2. **useMemo**、**useCallback**での計算結果キャッシュ
3. **React.lazy**による遅延ローディング
4. **Suspense**による非同期コンポーネント制御

### エラーハンドリング

1. **ErrorBoundary**による例外捕捉
2. **PanelErrorBoundary**でのパネル固有エラー処理
3. **適切なフォールバック表示**

## 🚀 使用例

### 基本的なコンポーネント使用

```typescript
import Panel from "@lichtblick/suite-base/components/Panel";
import { PanelConfig } from "@lichtblick/suite-base/types/panels";

interface MyPanelConfig extends PanelConfig {
  title: string;
}

function MyPanelComponent({ config, saveConfig }: PanelProps<MyPanelConfig>) {
  return (
    <div>
      <h1>{config.title}</h1>
    </div>
  );
}

MyPanelComponent.panelType = "MyPanel";
MyPanelComponent.defaultConfig = { title: "Default Title" };

export default Panel(MyPanelComponent);
```

### レイアウト管理

```typescript
import PanelLayout from "@lichtblick/suite-base/components/PanelLayout";

function MyLayout() {
  return (
    <PanelLayout
      layout={mosaicLayout}
      onChange={handleLayoutChange}
    />
  );
}
```

## 📊 メトリクス・統計

- **総ファイル数**: 100+個
- **コアコンポーネント**: 30+個
- **サブディレクトリ**: 15+個
- **最大ファイルサイズ**: Panel.tsx（684行）
- **平均ファイルサイズ**: 約100-200行

## 🔗 関連ドキュメント

- [PanelAPI Documentation](../PanelAPI/README.md)
- [Context System](../context/README.md)
- [Types Definition](../types/README.md)
- [Hooks Usage](../hooks/README.md)

## 🎯 次のステップ

1. **個別サブディレクトリの詳細調査**
2. **コンポーネント間の依存関係分析**
3. **パフォーマンス最適化の検討**
4. **新規コンポーネント開発ガイドライン策定**

---

**注意**: このドキュメントは、componentsディレクトリの概要を提供します。詳細な実装については、各ファイルのJSDocコメントと型定義を参照してください。
