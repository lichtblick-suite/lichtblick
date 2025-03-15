/* eslint-disable react/forbid-component-props */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable no-restricted-imports */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @lichtblick/strict-equality */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable no-restricted-syntax */
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from "@mui/material";
import { Eye, Trash2 } from "lucide-react";
import React, { useState, useEffect } from "react";

interface FileInfo {
  name: string;
  path: string;
  isImage: boolean;
  size: number;
  lastModified: Date;
}

interface FileListProps {
  directory?: string;
  onFileSelect?: (file: FileInfo) => void;
}

const FileList: React.FC<FileListProps> = ({ directory = "documents" }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.fileRenderer.listFiles(directory);

      //result.data.push(await window.electron.fileRenderer.listFiles("mapsimage"));
      if (result.success && result.data) {
        const fileInfos = await Promise.all(
          result.data.map(async (filename: { match: (arg0: RegExp) => null }) => {
            const stats = await window.electron.fileRenderer.getFileStats(directory, filename);
            return {
              name: filename,
              path: `${directory}/${filename}`,
              isImage: filename.match(/\.(jpg|jpeg|png|gif|bmp)$/i) !== null,
              size: stats.data?.size || 0,
              lastModified: new Date(stats.data?.mtime || Date.now()),
            };
          }),
        );
        setFiles(fileInfos);
      } else {
        setError(result.error || "加载文件列表失败");
      }
    } catch (err) {
      setError("加载文件列表时出错");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [directory]);

  const handlePreview = async (file: FileInfo) => {
    try {
      const result = await window.electron.fileRenderer.readFile(directory, file.name);
      if (result.success && result.data) {
        if (file.isImage) {
          // 对于图片，创建 blob URL
          const blob = new Blob([result.data]);
          setPreviewContent(URL.createObjectURL(blob));
        } else {
          // 对于 JSON 文件，尝试格式化显示
          const text = new TextDecoder().decode(result.data);
          try {
            const json = JSON.parse(text);
            setPreviewContent(JSON.stringify(json, null, 2) ?? "");
          } catch {
            setPreviewContent(text);
          }
        }
        setPreviewFile(file);
      }
    } catch (err) {
      console.error("预览文件失败:", err);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    try {
      const result = await window.electron.fileRenderer.deleteFile(directory, file.name);
      if (result.success) {
        await loadFiles();
      } else {
        setError(result.error || "删除文件失败");
      }
    } catch (err) {
      console.error("删除文件失败:", err);
      setError("删除文件失败");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return "0 Bytes";
    }
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Box>
      <Paper elevation={2}>
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            已保存的文件
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {files.length === 0 ? (
                <Typography color="textSecondary" align="center" py={4}>
                  没有找到文件
                </Typography>
              ) : (
                files.map((file, index) => (
                  <React.Fragment key={file.path}>
                    <ListItem>
                      <ListItemText
                        primary={file.name}
                        secondary={
                          <>
                            {formatFileSize(file.size)} • {file.lastModified.toLocaleString()}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="preview"
                          onClick={async () => {
                            await handlePreview(file);
                          }}
                          sx={{ mr: 1 }}
                        >
                          <Eye size={20} />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={async () => {
                            await handleDelete(file);
                          }}
                          color="error"
                        >
                          <Trash2 size={20} />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < files.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </List>
          )}
        </Box>
      </Paper>

      <Dialog
        open={Boolean(previewFile)}
        onClose={() => {
          setPreviewFile(null);
          setPreviewContent(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{previewFile?.name}</DialogTitle>
        <DialogContent>
          {previewFile?.isImage ? (
            <Box
              component="img"
              src={previewContent ?? ""}
              alt={previewFile.name}
              sx={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
            />
          ) : (
            <Box
              component="pre"
              sx={{
                maxHeight: "70vh",
                overflow: "auto",
                p: 2,
                backgroundColor: "#f5f5f5",
                borderRadius: 1,
              }}
            >
              {previewContent}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPreviewFile(null);
              setPreviewContent(null);
            }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileList;
