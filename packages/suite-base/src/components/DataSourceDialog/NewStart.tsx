/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Typography, List, Button } from "antd";
import { useTranslation } from "react-i18next";

// 假设这些组件已经在你的项目中存在
import TextMiddleTruncate from "@lichtblick/suite-base/components/TextMiddleTruncate";
import UdpMessageComponent from "@lichtblick/suite-base/components/UdpMessage";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";

const { Title } = Typography;

const NewStart = () => {
  const { t } = useTranslation("openDialog");

  // 这个函数用于检测是否在Electron环境中运行
  const isRunningInElectron = () => {
    return window.electron !== undefined || (window.process && window.process.type === "renderer");
  };

  // 假设这些数据和函数在你的应用中已定义
  const { recentSources, selectRecent } = usePlayerSelection();

  //   const selectRecent = (id) => {
  //     console.log(`选择了ID为${id}的源`);
  //     // 这里添加你的选择逻辑
  //   };

  return (
    <div style={{ padding: "40px" }}>
      <Title level={2}>开始</Title>
      {/* <Card title={t("recentDataSources")} style={{ marginBottom: "20px" }}> */}
      <Title level={5}>{t("recentDataSources")}</Title>
      <List
        itemLayout="horizontal"
        dataSource={recentSources.slice(0, 5)}
        renderItem={(recent) => (
          <List.Item key={recent.id} id={recent.id} style={{ padding: 0 }}>
            <Button
              type="text"
              block
              onClick={() => {
                selectRecent(recent.id);
              }}
              style={{
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 16px",
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "45%",
                }}
              >
                <TextMiddleTruncate text={recent.label ?? ""} />
              </div>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "45%",
                }}
              >
                <TextMiddleTruncate text={recent.title} />
              </div>
            </Button>
          </List.Item>
        )}
      />
      {isRunningInElectron() && (
        <>
          <Title level={5}>{t("activeClients")}</Title>
          <UdpMessageComponent />
        </>
      )}
      {/* </Card> */}
    </div>
  );
};

export default NewStart;
