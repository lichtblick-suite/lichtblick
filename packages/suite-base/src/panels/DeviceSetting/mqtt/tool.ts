/**
 * 从public获取资源<br/>
 * 链接必须是以`/`开头<br/>
 * 如：`public/MQTT.json` 则输入的链接应该是 `/MQTT.json`
 * @param url 链接
 * @returns 结果回调
 */
export const getForURL = async <T>(url: string): Promise<T> => {
  const data = await fetch(url);
  const json = await data.json();
  return json as T;
};

/**
 * 字符串插入<br/>
 * 正数倒数都可以<br/>
 * 正数第一位为0<br/>
 * 倒数第一位为-1
 * @param src 原字符串
 * @param pos 插入位置
 * @param val 插入字符串
 * @returns 结果字符串
 */
export const insertStr = (src: string, pos: number, val: string): string => {
  if (pos < -src.length - 1 || pos > src.length) return src;
  if (pos >= 0) return src.slice(0, pos) + val + src.slice(pos);
  else return src.slice(0, src.length + 1 + pos) + val + src.slice(src.length + 1 + pos);
};

/**
 * 生成一个不重复的id
 * @param randomLength 随机长度(强度)
 * @returns 随机id
 */
export const getNonDuplicateID = (randomLength: number = 5): string => {
  return Number(Math.random().toString().substring(2, randomLength) + Date.now()).toString(36);
};

/**
 * 从静态资源列表中获取url<br/>
 * 请使用<br/>
 * import.meta.glob("***路径***", {as: "url",eager: true,});<br/>
 * 获取静态资源列表
 * @param imports 静态资源列表
 * @param title 文件标识
 * @returns url
 */
// export const getURL = (
//   imports: Record<string, string>,
//   title?: string
// ): string => {
//   for (const path in imports) {
//     if (title && path.indexOf(title) !== -1) {
//       // eslint-disable-next-line security/detect-object-injection
//       return imports[path];
//     }
//   }
//   return "";
// };

/**
 * 数字格式化<br/>
 * 将1格式化为01<br/>
 * 以minLen为最小长度
 * @param num 数值
 * @param minLen 最小长度
 * @returns 格式化后的字符串
 */
export const numberFormatted = (num?: number, minLen: number = 2) => {
  minLen -= 1;
  if (num && num > 0 && num < 10 * minLen) {
    let result = "";
    for (let index = 0; index < minLen; index++) {
      result += "0";
    }
    return result + num;
  } else {
    return num;
  }
};
