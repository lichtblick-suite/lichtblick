import { join } from "path";
import { Page } from "playwright";

export const loadFromFilePicker = async (
  mainWindow: Page,
  filenames: string | string[],
): Promise<void> => {
  // Normalize to array
  const files = Array.isArray(filenames) ? filenames : [filenames];
  const fileInfos = files.map((filename) => ({
    path: join(__dirname, `./assets/${filename}`),
    name: filename,
  }));

  await mainWindow.evaluate(async (infos) => {
    const mockFileHandles = await Promise.all(
      infos.map(async ({ path, name }) => {
        const response = await fetch(`file://${path}`);
        const content = await response.text();

        const file = new File([content], name, { type: "application/json" });

        // Mock FileSystemFileHandle
        return {
          getFile: async () => file,
          kind: "file" as const,
          name,
        };
      }),
    );

    // Mock window.showOpenFilePicker
    window.showOpenFilePicker = async () => mockFileHandles as [FileSystemFileHandle];
  }, fileInfos);
};
