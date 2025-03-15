/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable no-underscore-dangle */
import { app } from "electron";
import fs from "fs";
import path from "path";

export interface FileOperation {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

type Callback = (result: FileOperation) => void;

export class StorageManager {
  private static _instance: StorageManager;
  private readonly basePath: string;
  private readonly directories: string[];

  private constructor() {
    this.basePath = path.join(app.getPath("userData"), "storage");
    this.directories = ["documents", "images", "temp"];
    this.initialize();
  }

  public static getInstance(): StorageManager {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!StorageManager._instance) {
      StorageManager._instance = new StorageManager();
    }
    return StorageManager._instance;
  }

  private initialize(): void {
    // 创建基础目录
    fs.mkdir(this.basePath, { recursive: true }, (err) => {
      if (err) {
        console.error("Failed to create base directory:", err);
        return;
      }

      // 创建子目录
      this.directories.forEach((dir) => {
        fs.mkdir(path.join(this.basePath, dir), { recursive: true }, (err: unknown) => {
          if (err) {
            console.error(`Failed to create directory ${dir}:`, err);
          }
        });
      });
    });
  }

  private validatePath(directory: string, filename?: string): boolean {
    if (!this.directories.includes(directory)) {
      return false;
    }

    if (filename) {
      return /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename);
    }

    return true;
  }

  public saveFile(
    directory: string,
    filename: string,
    data: string | Buffer,
    callback: Callback,
  ): void {
    if (!this.validatePath(directory, filename)) {
      callback({
        success: false,
        error: "Invalid directory or filename",
      });
      return;
    }

    const filePath = path.join(this.basePath, directory, filename);
    fs.writeFile(filePath, data, (err) => {
      if (err) {
        callback({
          success: false,
          error: err.message,
        });
        return;
      }
      callback({
        success: true,
        data: filePath,
      });
    });
  }

  public readFile(directory: string, filename: string, callback: Callback): void {
    if (!this.validatePath(directory, filename)) {
      callback({
        success: false,
        error: "Invalid directory or filename",
      });
      return;
    }

    const filePath = path.join(this.basePath, directory, filename);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        callback({
          success: false,
          error: err.message,
        });
        return;
      }
      callback({
        success: true,
        data,
      });
    });
  }

  public listFiles(directory: string, callback: Callback): void {
    if (!this.validatePath(directory)) {
      callback({
        success: false,
        error: "Invalid directory",
      });
      return;
    }

    const dirPath = path.join(this.basePath, directory);
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        callback({
          success: false,
          error: err.message,
        });
        return;
      }
      callback({
        success: true,
        data: files,
      });
    });
  }

  public deleteFile(directory: string, filename: string, callback: Callback): void {
    if (!this.validatePath(directory, filename)) {
      callback({
        success: false,
        error: "Invalid directory or filename",
      });
      return;
    }

    const filePath = path.join(this.basePath, directory, filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        callback({
          success: false,
          error: err.message,
        });
        return;
      }
      callback({
        success: true,
      });
    });
  }

  public fileExists(directory: string, filename: string, callback: Callback): void {
    if (!this.validatePath(directory, filename)) {
      callback({
        success: false,
        error: "Invalid directory or filename",
      });
      return;
    }

    const filePath = path.join(this.basePath, directory, filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
      callback({
        success: !err,
        data: !err,
      });
    });
  }

  public getFileStats(directory: string, filename: string, callback: Callback): void {
    if (!this.validatePath(directory, filename)) {
      callback({
        success: false,
        error: "Invalid directory or filename",
      });
      return;
    }

    const filePath = path.join(this.basePath, directory, filename);
    fs.stat(filePath, (err, stats) => {
      if (err) {
        callback({
          success: false,
          error: err.message,
        });
        return;
      }
      callback({
        success: true,
        data: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
        },
      });
    });
  }
}

// 使用示例：
/*
const storage = StorageManager.getInstance();

// 保存文件
storage.saveFile("documents", "test.txt", "Hello World", (result) => {
  if (result.success) {
    console.log("File saved at:", result.data);
  } else {
    console.error("Save failed:", result.error);
  }
});

// 读取文件
storage.readFile("documents", "test.txt", (result) => {
  if (result.success) {
    console.log("File contents:", result.data.toString());
  } else {
    console.error("Read failed:", result.error);
  }
});

// 列出文件
storage.listFiles("documents", (result) => {
  if (result.success) {
    console.log("Files in directory:", result.data);
  } else {
    console.error("List failed:", result.error);
  }
});
*/
