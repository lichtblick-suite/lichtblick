class FunInfo {
  title: string;
  fun: (message: string) => void;
  store: boolean;

  constructor(title: string, fun: (message: string) => void, store: boolean) {
    this.title = title;
    this.fun = fun;
    this.store = store;
  }
}

export default class Dispatcher {
  /**
   * 映射池<br/>
   * 用于存储主题与对应需要触发的函数<br/>
   * key:主题 string<br/>
   * value:映射函数列表
   */
  private mapper: Map<string, FunInfo[]>;

  public add(topic: string, title: string, fun: (message: string) => void, store: boolean) {
    const info = new FunInfo(title, fun, store);
    if (this.mapper.has(topic)) {
      this.mapper.get(topic)?.push(info);
    } else {
      this.mapper.set(topic, [info]);
    }
  }

  /**
   * 触发事件
   * @param topic 主题
   * @param message 消息
   */
  public trigger(topic: string, message: string) {
    this.mapper.get(topic)?.forEach((info: FunInfo) => {
      // console.log(message);
      info.fun(message);
    });
  }

  /**
   *删除记录中的对应触发函数
   * @param topic 主题
   * @param title 标题
   * @returns 是否应该退订主题
   */
  public remove(topic: string, title: string, store: boolean = false): boolean {
    if (this.mapper.has(topic) && this.mapper.get(topic)) {
      const arr = this.mapper
        .get(topic)!
        .filter((info: FunInfo) => info.title !== title || (info.store && !store));
      if (arr.length < 1) {
        this.mapper.delete(topic);
        return true;
      } else {
        this.mapper.set(topic, arr);
        return false;
      }
    } else return true;
  }

  /**
   *删除所有对应该标题的触发函数
   * @param title 标题
   * @returns 需要退订的主题列表
   */
  public removeAll(title: string): string[] {
    const topics = [];
    if (this.mapper.size === 0) {
      return [];
    }
    for (const key of this.mapper.keys()) {
      if (this.remove(key, title)) topics.push(key);
    }
    return topics;
  }

  /** 单例类实例*/
  private static dispatcher: Dispatcher;

  /**初始化 */
  private constructor() {
    this.mapper = new Map();
  }
  /**
   * 清理所有订阅和回调
   */
  public clearAll(): void {
    this.mapper.clear();
  }

  /** 获取实例*/
  public static getInstance() {
    return Dispatcher.dispatcher ? Dispatcher.dispatcher : new Dispatcher();
  }
}
