import EventEmitter from "eventemitter3";
import { EventListenerHandler } from "@lichtblick/suite-base/components/Chart/types";
/**
 * WebWorker内でのDOMイベントハンドリング
 *
 * WebWorker環境では実際のDOMが存在しないため、EventEmitterを使用して
 * DOM風のイベントシステムを模倣します。Chart.jsプラグイン（特にZoomプラグイン）が
 * addEventListener/removeEventListenerを期待するため、これらの関数を提供します。
 *
 * ## 使用例
 * ```typescript
 * const fakeNode = {
 *   addEventListener: addEventListener(eventEmitter),
 *   removeEventListener: removeEventListener(eventEmitter),
 * };
 *
 * // Chart.jsプラグインがこれらを呼び出す
 * fakeNode.addEventListener('wheel', handleWheel);
 * ```
 */
/**
 * EventEmitterベースのaddEventListenerを作成
 *
 * DOM APIのaddEventListenerと同様の動作をEventEmitterで実現します。
 * 重複したリスナーの追加を防ぎ、Chart.jsプラグインとの互換性を保ちます。
 *
 * @param emitter - EventEmitterインスタンス
 * @returns addEventListener関数
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter();
 * const addListener = addEventListener(emitter);
 *
 * addListener('click', () => console.log('clicked'));
 * ```
 */
export declare function addEventListener(emitter: EventEmitter): EventListenerHandler;
/**
 * EventEmitterベースのremoveEventListenerを作成
 *
 * DOM APIのremoveEventListenerと同様の動作をEventEmitterで実現します。
 * 指定されたイベントリスナーを安全に削除し、Chart.jsプラグインとの
 * 互換性を保ちます。
 *
 * @param emitter - EventEmitterインスタンス
 * @returns removeEventListener関数
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter();
 * const removeListener = removeEventListener(emitter);
 *
 * removeListener('click', clickHandler);
 * ```
 */
export declare function removeEventListener(emitter: EventEmitter): EventListenerHandler;
