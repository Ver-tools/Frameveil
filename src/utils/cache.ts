import { invoke } from '@tauri-apps/api/core';

/** 获取缓存目录占用空间（字节） */
export async function getCacheSize(): Promise<number> {
  try {
    return await invoke<number>('cache_size');
  } catch {
    return 0;
  }
}

/** 清空缓存目录，返回本次清理的字节数 */
export async function clearAppCache(): Promise<number> {
  try {
    return await invoke<number>('clear_cache');
  } catch {
    return 0;
  }
}
