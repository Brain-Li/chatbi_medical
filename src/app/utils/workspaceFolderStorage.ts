const DATABASE_NAME = 'chatbi-medical-workspace-folders';
const STORE_NAME = 'folders';
export const WORKSPACE_FOLDERS_CHANGED = 'chatbi-medical-workspace-folders-changed';

type WorkspaceFolder = { workspaceName: string; directory: FileSystemDirectoryHandle };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'workspaceName' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readWorkspaceFolders(): Promise<Map<string, FileSystemDirectoryHandle>> {
  const db = await openDatabase();
  try {
    const records = await new Promise<WorkspaceFolder[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Map(records.map(({ workspaceName, directory }) => [workspaceName, directory]));
  } finally {
    db.close();
  }
}

async function updateWorkspaceFolders(update: (store: IDBObjectStore) => void) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      update(transaction.objectStore(STORE_NAME));
    });
  } finally {
    db.close();
  }
  window.dispatchEvent(new Event(WORKSPACE_FOLDERS_CHANGED));
}

export function saveWorkspaceFolder(workspaceName: string, directory: FileSystemDirectoryHandle) {
  return updateWorkspaceFolders((store) => store.put({ workspaceName, directory } satisfies WorkspaceFolder));
}

export function renameWorkspaceFolder(from: string, to: string) {
  return updateWorkspaceFolders((store) => {
    const request = store.get(from);
    request.onsuccess = () => {
      const record: WorkspaceFolder | undefined = request.result;
      if (!record) return;
      store.put({ ...record, workspaceName: to });
      store.delete(from);
    };
  });
}

export function removeWorkspaceFolder(workspaceName: string) {
  return updateWorkspaceFolders((store) => store.delete(workspaceName));
}
