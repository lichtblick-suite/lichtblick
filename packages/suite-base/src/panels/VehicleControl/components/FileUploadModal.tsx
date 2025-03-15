/* eslint-disable react/forbid-component-props */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-restricted-imports */
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Box,
  Typography,
  Alert,
} from "@mui/material";
// import { IpcRendererEvent } from "electron";
// import { Upload } from "lucide-react";
import React, { useState, useRef } from "react";

import FileList from "@lichtblick/suite-base/panels/VehicleControl/components/FileList";
// import { FileOperation } from "@lichtblick/suite-desktop/src/main/StorageManager";

export interface FileUploadModalProps {
  open: boolean;
  onClose: () => void;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({ open, onClose }) => {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleJsonSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/json") {
        setJsonFile(file);
        setError("");
      } else {
        setError("请选择有效的 JSON 文件");
        setJsonFile(null);
      }
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setImageFile(file);
        setError("");
      } else {
        setError("请选择有效的图片文件");
        setImageFile(null);
      }
    }
  };

  const handleSave = async () => {
    if (!jsonFile || !imageFile) {
      setError("请选择所有必需的文件");
      return;
    }

    try {
      // 读取 JSON 文件
      const jsonContent = await jsonFile.text();

      // 读取图片文件
      const imageReader = new FileReader();
      imageReader.readAsArrayBuffer(imageFile);

      imageReader.onload = async () => {
        if (imageReader.result) {
          // 保存文件到用户文件夹
          const jsonResult = await window.electron.fileRenderer.saveFile(
            "documents",
            jsonFile.name,
            jsonContent,
          );

          const imageResult = await window.electron.fileRenderer.saveFile(
            "documents",
            imageFile.name,
            Buffer.from(imageReader.result as ArrayBuffer),
          );

          if (jsonResult.success && imageResult.success) {
            onClose();
          } else {
            setError("保存文件失败");
          }
        }
      };
    } catch (err) {
      setError("文件处理失败");
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <FileList />
      <DialogTitle>上传文件</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              JSON 文件
            </Typography>
            <input
              type="file"
              accept=".json"
              onChange={handleJsonSelect}
              ref={jsonInputRef}
              style={{ display: "none" }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                value={jsonFile?.name ?? ""}
                placeholder="选择 JSON 文件"
                InputProps={{ readOnly: true }}
              />
              <Button
                variant="outlined"
                // startIcon={<Upload size={20} />}
                onClick={() => jsonInputRef.current?.click()}
              >
                浏览
              </Button>
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              图片文件
            </Typography>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              ref={imageInputRef}
              style={{ display: "none" }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                value={imageFile?.name ?? ""}
                placeholder="选择图片文件"
                InputProps={{ readOnly: true }}
              />
              <Button
                variant="outlined"
                // startIcon={<Upload size={20} />}
                onClick={() => imageInputRef.current?.click()}
              >
                浏览
              </Button>
            </Box>
          </Box>

          {imageFile && (
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "200px",
                  objectFit: "contain",
                }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" disabled={!jsonFile || !imageFile}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUploadModal;
