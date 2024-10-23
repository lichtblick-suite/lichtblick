import { Light, LightState } from "@lichtblick/suite-base/panels/DeviceSetting/types";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from "@mui/material";
import { ifElse } from "ramda";
import { useEffect, useState } from "react";

interface LightEditDialogProps {
  editingLight: Light;
  isModalVisible: boolean;
  handleCancel: () => void;
  handleOk: (light: any) => void;
}
// 定义一个辅助函数来处理 state 到 value 的转换
const getStateValue = (state: string): string => {
  if (state === "RED") return "1";
  if (state === "GREEN") return "2";
  if (state === "YELLOW") return "3";
  return state;
};

// 在 RadioGroup 中使用该函数

const LightEditDialog = (props: LightEditDialogProps) => {
  const { editingLight, isModalVisible, handleCancel, handleOk } = props;

  const [formValues, setFormValues] = useState<Light>({
    id: 0,
    state: LightState.RED,
    time: 0,
    greenTime: 0,
    yellowTime: 0,
    redTime: 0,
  });
  const handleChange = (event: { target: { name: any; value: any } }) => {
    const { name, value } = event.target;
    setFormValues((prevValues: any) => ({
      ...prevValues,
      [name]: value,
    }));
  };

  const onSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    handleOk(formValues);
  };
  useEffect(() => {
    const result = editingLight ?? {
      id: 0,
      state: LightState.RED,
      time: 0,
      greenTime: 0,
      yellowTime: 0,
      redTime: 0,
    };
    setFormValues(result);
  }, [isModalVisible]);

  return (
    <Dialog open={isModalVisible} onClose={handleCancel} fullWidth maxWidth="sm">
      <DialogTitle>Edit Light {editingLight?.id}</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <TextField
            label="Time"
            name="time"
            fullWidth
            margin="normal"
            value={formValues.time || 0}
            onChange={handleChange}
            required
          />
          <FormControl component="fieldset" margin="normal" fullWidth>
            <RadioGroup
              row
              name="state"
              value={getStateValue(formValues.state.toString())}
              onChange={handleChange}
            >
              <FormControlLabel value="1" control={<Radio />} label="红灯" />
              <FormControlLabel value="2" control={<Radio />} label="绿灯" />
              <FormControlLabel value="3" control={<Radio />} label="黄灯" />
            </RadioGroup>
          </FormControl>
          <TextField
            label="Red Time"
            name="redTime"
            fullWidth
            margin="normal"
            value={formValues.redTime || ""}
            onChange={handleChange}
            required
          />
          <TextField
            label="Green Time"
            name="greenTime"
            fullWidth
            margin="normal"
            value={formValues.greenTime || ""}
            onChange={handleChange}
            required
          />
          <TextField
            label="Yellow Time"
            name="yellowTime"
            fullWidth
            margin="normal"
            value={formValues.yellowTime || ""}
            onChange={handleChange}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} color="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default LightEditDialog;
