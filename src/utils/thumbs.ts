import { ref, type Ref } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

/** 已解析的缩略图地址缓存（path → asset URL）；空串表示后端不支持，回退原图 */
const resolved = new Map<string, string>();
/** 进行中的请求去重 */
const pending = new Map<string, Promise<string>>();

/**
 * 获取照片的显示用小图地址（响应式）：
 * - 内置照片 / 无磁盘路径 → 直接返回原 src
 * - 磁盘照片 → 优先 Rust 生成的缩略图（缓存于 <AppCache>/thumbs），
 *   不支持的格式（RAW 等）或生成失败时回退原 src
 */
export function useThumbSrc(
  path: string | undefined,
  fallbackSrc: string,
  maxDim = 480
): Ref<string> {
  const src = ref(fallbackSrc);
  if (!path || typeof path !== 'string') return src;

  // 命中缓存直接同步返回
  const hit = resolved.get(path);
  if (hit !== undefined) {
    if (hit) src.value = hit;
    return src;
  }

  let p = pending.get(path);
  if (!p) {
    p = invoke<string | null>('get_thumbnail', { path, maxDim })
      .then((thumbPath) => {
        const url = thumbPath ? convertFileSrc(thumbPath) : '';
        resolved.set(path, url);
        return url;
      })
      .catch(() => {
        resolved.set(path, '');
        return '';
      })
      .finally(() => pending.delete(path));
    pending.set(path, p);
  }

  p.then((url) => {
    if (url) src.value = url;
  });
  return src;
}

/** 预取缩略图（用于查看器前后照片预热），失败静默 */
export function prefetchThumb(path: string, maxDim = 480): void {
  if (!path || resolved.has(path) || pending.has(path)) return;
  useThumbSrc(path, '', maxDim);
}
