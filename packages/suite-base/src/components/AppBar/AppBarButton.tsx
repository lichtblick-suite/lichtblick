import React from "react";
import { Button } from "antd";
// import "./MyButton.css"; // 引入自定义样式
type Prop = {
  onClick: (arg0?: any) => void;
  text: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};
const AppBarButton: React.FC<Prop> = (props: Prop) => {
  return (
    <Button
      type="text"
      icon={props.icon}
      style={{
        width: "50px",
        height: "50px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <span style={{ fontSize: "12px", marginTop: "0px" }}>{props.text}</span>
    </Button>
  );
};

export default AppBarButton;
