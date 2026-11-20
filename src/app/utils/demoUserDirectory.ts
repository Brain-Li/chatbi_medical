export type UserRow = { id: string; username: string; name: string; email: string; role: '超级管理员' | '管理员' | '普通用户'; enabled: boolean };

export const demoUserStorageKey = 'chatbi-medical-users-v1';
const initialUsers: UserRow[] = [
  { id: '1', username: 'liusy', name: 'liusy', email: '320616101@qq.com', role: '普通用户', enabled: true },
  { id: '2', username: 'libin', name: '李斌', email: '862258792@qq.com', role: '普通用户', enabled: true },
  { id: '3', username: 'test2', name: 'test2', email: 'chenbai@futongdf.com.cn', role: '超级管理员', enabled: true },
  { id: '4', username: 'zhaoyy', name: 'zhaoyy', email: '', role: '普通用户', enabled: true },
  { id: '5', username: 'test', name: '测试', email: 'chenbai@futongdf.com.cn', role: '超级管理员', enabled: true },
  { id: '6', username: 'admin', name: '管理员', email: 'admin@example.com', role: '超级管理员', enabled: true },
];

export function readDemoUsers(): UserRow[] {
  try {
    const value = JSON.parse(localStorage.getItem(demoUserStorageKey) ?? 'null');
    if (Array.isArray(value) && value.every((row) => row && ['id', 'username', 'name', 'email'].every((key) => typeof row[key] === 'string') && ['超级管理员', '管理员', '普通用户'].includes(row.role) && typeof row.enabled === 'boolean')) return value;
  } catch { /* Use sample users when browser storage is unavailable. */ }
  return initialUsers;
}
