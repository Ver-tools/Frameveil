import { invoke } from '@tauri-apps/api/core';
import type { Photo } from '../types';
import { toast } from '../store/library';

/**
 * 将照片导出到目标目录：
 * - 磁盘照片直接通过 Rust 命令复制
 * - 内置示例照片通过 fetch → base64 → Rust 写入
 */
export async function exportPhotosToDir(
  photos: Photo[],
  destDir: string,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const total = photos.length;
  if (!total) return 0;
  let done = 0;

  const diskPhotos = photos.filter((p) => p.path && !p.builtin);
  if (diskPhotos.length) {
    try {
      await invoke('copy_photos', {
        sources: diskPhotos.map((p) => p.path),
        destDir,
      });
    } catch (e) {
      toast(`导出失败：${String(e)}`, 'error');
      return done;
    }
    done = diskPhotos.length;
    onProgress?.(done, total);
  }

  for (const p of photos) {
    if (p.path && !p.builtin) continue;
    try {
      const res = await fetch(p.src);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const data = btoa(binary);
      await invoke('write_photo', { destDir, fileName: p.fileName, data });
      done += 1;
      onProgress?.(done, total);
    } catch {
      /* 跳过无法导出的文件 */
    }
  }
  return done;
}
