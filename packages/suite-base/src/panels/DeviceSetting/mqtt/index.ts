import mqtt, { MqttClient } from "mqtt";
import Dispatcher from "./dispatcher";
import { getNonDuplicateID } from "./tool";
import { MQTTConfig } from "./config";

/**
 * 封装MQTT
 */
class MQTT {
  /**mqtt客户端实例 */
  private client: MqttClient | null = null;

  /**消息分发实例 */
  private dispatcher: Dispatcher;

  /**
   * 订阅<br/>
   * 注意:<br/>
   * 标题需要与函数一一对应<br/>
   * 所以标题请使用页面名+函数名<br/>
   * 不过即使标题重名也不会有什么大问题
   * @param topic 主题
   * @param title 标题
   * @param fun 触发函数
   */
  public subscribe(
    topic: string,
    title: string,
    fun: (message: string) => void,
    store: boolean = false,
  ): void {
    this.dispatcher.add(topic, title, fun, store);
    this.client?.subscribe(topic, (error: Error | null) => {
      if (error) {
        this.drop(title);
      }
    });
  }

  /**
   * 退订
   * @param topic 主题
   * @param title 标题
   */
  public unsubscribe(topic: string, title: string, store: boolean = false) {
    if (this.dispatcher.remove(topic, title, store)) this.client?.unsubscribe(topic);
  }

  /**
   * 使用标题删除触发函数
   * @param title 标题
   */
  public drop(title: string) {
    const topics = this.dispatcher.removeAll(title);
    if (topics.length === 0) {
      return;
    } else this.client?.unsubscribe(topics);
  }

  /**
   * 页面销毁时调用，用以删除对应标题的全部触发函数
   * @param titles 标题列表
   */
  public pageDrop(...titles: string[]) {
    titles.forEach((title) => this.client?.unsubscribe(this.dispatcher.removeAll(title)));
  }

  /**
   * 发布消息到主题
   * @param topic 主题
   * @param msg 消息
   */
  public publish(topic: string, msg: string): void {
    this.client?.publish(topic, msg);
  }

  /**
   * 初始化链接
   */
  async init(config: MQTTConfig) {
    const url = "ws://" + config.host + ":" + config.post + "/mqtt";
    console.log(url);
    this.client = mqtt.connect(url, {
      clientId: config.clientId + getNonDuplicateID(),
    });
    //链接创建成功后写入客户端实例
    this.client.on("connect", () => {});
    //将接收到的消息传向分发器
    this.client?.on("message", (topic: string, message: Buffer) => {
      this.dispatcher.trigger(topic, message.toString());
    });
    return this.client;
  }

  /**单例类实例 */
  private static mqttClient: MQTT | null = null;
  /**
   * 销毁 MQTT 实例，断开连接并清理资源
   */
  public destroy(): void {
    if (this.client) {
      this.client.end(false, () => {
        console.log("已断开与 MQTT 代理服务器的连接");
      });
      this.client.removeAllListeners();
      this.client = null;
    }
    // 清理分发器中的所有订阅
    this.dispatcher.clearAll();
    // 重置单例实例
    MQTT.mqttClient = null;
  }

  /**单例创建客户端 */
  private constructor() {
    this.dispatcher = Dispatcher.getInstance();
  }

  /**获取单例 */
  public static getInstance(): MQTT {
    if (MQTT.mqttClient) {
      return MQTT.mqttClient;
    } else {
      MQTT.mqttClient = new MQTT();
      return MQTT.mqttClient;
    }
  }
}

export default MQTT.getInstance();

export { MQTT };
