// C:\Users\18032\Desktop\lichtblick\packages\suite-base\src\components\TriplePlotPanel.tsx
import SinglePlot from "./SinglePlot";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
//@ts-ignore
const TriplePlotPanel = ({ config , saveConfig }) => {
  const updatePlotConfig = (plotKey: string) => (updater: (prevConfig: any) => any) => {
    saveConfig((prevConfig: { [x: string]: any }) => {
      // 只更新指定的 plot 配置，避免影响其他 plot
      return { ...prevConfig, [plotKey]: updater(prevConfig[plotKey]) };
    });
  };

  // 跟踪当前选中的 plot，确保只有在用户主动选择时才切换面板设置
  const [selectedPlot, setSelectedPlot] = React.useState("plot1");

  const handlePlotSelection = (plotKey: string) => {
    console.log("Selected plot:", plotKey);
    setSelectedPlot(plotKey);
  };

  // @ts-ignore
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 第一个 plot */}
      <PanelToolbar />
      <SinglePlot
        config={config.plot1}
        //@ts-ignore
        saveConfig={updatePlotConfig("plot1")}
        panelId="triple-plot-1" // 唯一标识符
        configPath="plot1"      // 层级路径
        onSelect={() => handlePlotSelection("plot1")}
        isSelected={selectedPlot === "plot1"}
      />
      {/* 第二个 plot */}
      <SinglePlot
        config={config.plot2}
        //@ts-ignore
        saveConfig={updatePlotConfig("plot2")}
        isSelected={selectedPlot === "plot2"}
        panelId="triple-plot-2"
        configPath="plot2"

        onSelect={() => handlePlotSelection("plot2")}
      />
      {/* 第三个 plot */}
      <SinglePlot
        config={config.plot3}
        //@ts-ignore
        saveConfig={updatePlotConfig("plot3")}
        isSelected={selectedPlot === "plot3"}
        panelId="triple-plot-3"
        configPath="plot3"
        onSelect={() => handlePlotSelection("plot3")}
      />
    </div>
  );
};

export default TriplePlotPanel;
