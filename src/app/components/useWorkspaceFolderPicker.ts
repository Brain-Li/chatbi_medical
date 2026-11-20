import { toast } from 'sonner';

const getPickerWindow = () => window as Window & {
  showDirectoryPicker?: (options: { mode: 'read'; startIn?: FileSystemDirectoryHandle }) => Promise<FileSystemDirectoryHandle>;
};

export function canShowWorkspaceFolder() {
  return typeof window !== 'undefined' && typeof getPickerWindow().showDirectoryPicker === 'function';
}

export async function showWorkspaceFolder(directory: FileSystemDirectoryHandle) {
  try {
    await getPickerWindow().showDirectoryPicker?.({ mode: 'read', startIn: directory });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    toast.error('无法显示文件夹，请重新选择原文件夹');
  }
}
