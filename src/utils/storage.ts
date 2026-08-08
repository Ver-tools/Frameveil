import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { library, toast } from '../store/library';

/** 默认存储位置的友好显示文案 */
export const DEFAULT_LOCATION_LABEL = '用户/Frameveil/图库';

/** 当前存储位置的显示文案 */
export function storageLocationLabel(): string {
  return library.settings.storageLocation || DEFAULT_LOCATION_LABEL;
}

/** 弹出目录选择器设置照片存储位置；成功返回 true */
export async function pickStorageLocation(): Promise<boolean> {
  let selected: string | string[] | null;
  try {
    selected = await open({
      directory: true,
      title: '选择照片存储位置',
    });
  } catch {
    toast('当前环境不支持选择目录', 'error');
    return false;
  }
  if (typeof selected !== 'string' || !selected) return false;
  try {
    const normalized = await invoke<string>('ensure_dir', { path: selected });
    library.settings.storageLocation = normalized;
    toast(`存储位置已设置为 ${normalized}`, 'success');
    return true;
  } catch (e) {
    toast(`无法使用该目录：${String(e)}`, 'error');
    return false;
  }
}

/** 恢复为默认存储位置（<AppData>/Frameveil/Library） */
export async function resetStorageLocation(): Promise<boolean> {
  try {
    const lib = await invoke<string>('library_dir');
    library.settings.storageLocation = lib;
    toast(`已恢复为默认存储位置：${lib}`, 'success');
    return true;
  } catch {
    toast('恢复默认位置失败', 'error');
    return false;
  }
}

/** 刷新当前存储位置已占用空间（返回字节数） */
export async function refreshStorageUsed(): Promise<number> {
  try {
    return await invoke<number>('storage_used', {
      path: library.settings.storageLocation || null,
    });
  } catch {
    return 0;
  }
}
