import { reactive, computed, watch } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { Album, Photo, Settings, PendingFile } from '../types';
import { buildSeed } from '../seed';

const LS_KEY = 'frameveil:library:v1';

/** 默认设置 */
function defaultSettings(): Settings {
  return {
    theme: 'light',
    language: '简体中文',
    defaultView: 'grid',
    storageLocation: '',
    autoOrganize: true,
    smartAlbum: false,
    autoBackup: true,
    duplicateHandling: '跳过',
    defaultAlbum: '按日期创建',
    keepOriginal: false,
    faceRecognition: true,
    locationInfo: false,
    analytics: false,
  };
}

/** 从本地缓存加载；无缓存时生成内置示例图库 */
function loadState(): { albums: Album[]; photos: Photo[]; settings: Settings } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.albums) && Array.isArray(parsed.photos)) {
        return {
          albums: parsed.albums as Album[],
          photos: parsed.photos as Photo[],
          settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
        };
      }
    }
  } catch {
    /* 忽略损坏数据 */
  }
  const seed = buildSeed();
  return { albums: seed.albums, photos: seed.photos, settings: defaultSettings() };
}

const initial = loadState();

/** 全局图库状态 */
export const library = reactive({
  albums: initial.albums as Album[],
  photos: initial.photos as Photo[],
  settings: initial.settings as Settings,
  toasts: [] as { id: number; message: string; kind: 'success' | 'error' | 'info' }[],
  /** 图片查看器的上下文（照片列表与当前索引） */
  viewerContext: null as {
    photos: Photo[];
    index: number;
    albumId?: string;
    back?: { label: string; route: string };
  } | null,
});

/* ── 持久化 ─────────────────────────────────────────────── */
let saveTimer: number | undefined;
watch(
  () => [library.albums, library.photos, library.settings],
  () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ albums: library.albums, photos: library.photos, settings: library.settings })
        );
      } catch {
        /* 存储空间不足时忽略 */
      }
    }, 200);
  },
  { deep: true }
);

/* ── 提示 ───────────────────────────────────────────────── */
let toastSeq = 0;
export function toast(message: string, kind: 'success' | 'error' | 'info' = 'info') {
  const id = ++toastSeq;
  library.toasts.push({ id, message, kind });
  window.setTimeout(() => {
    library.toasts = library.toasts.filter((t) => t.id !== id);
  }, 2600);
}

/* ── 计算属性 ───────────────────────────────────────────── */
export const albumsWithCounts = computed(() =>
  library.albums.map((a) => ({
    ...a,
    photoCount: library.photos.filter((p) => p.albumId === a.id && !p.inTrash).length,
  }))
);

/** 所有标签及其计数 */
export const allTags = computed(() => {
  const map = new Map<string, number>();
  for (const p of library.photos) {
    if (p.inTrash) continue;
    for (const t of p.tags) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
});

/* ── 查询 ───────────────────────────────────────────────── */
export function albumById(id: string): Album | undefined {
  return library.albums.find((a) => a.id === id);
}

export function photoById(id: string): Photo | undefined {
  return library.photos.find((p) => p.id === id);
}

export function photosOfAlbum(albumId: string): Photo[] {
  return library.photos.filter((p) => p.albumId === albumId && !p.inTrash);
}

export function albumPhotos(albumId: string): Photo[] {
  return photosOfAlbum(albumId);
}

/* ── 照片操作 ───────────────────────────────────────────── */
export function updatePhoto(id: string, patch: Partial<Photo>) {
  const p = library.photos.find((x) => x.id === id);
  if (p) Object.assign(p, patch);
}

export function toggleFavorite(id: string) {
  const p = library.photos.find((x) => x.id === id);
  if (p) {
    p.isFavorite = !p.isFavorite;
    toast(p.isFavorite ? '已加入收藏' : '已取消收藏');
  }
}

export function trashPhoto(id: string) {
  const p = library.photos.find((x) => x.id === id);
  if (p) {
    p.inTrash = true;
    p.trashedAt = Date.now();
    toast('已移入回收站', 'info');
  }
}

export function restorePhoto(id: string) {
  const p = library.photos.find((x) => x.id === id);
  if (p) {
    p.inTrash = false;
    p.trashedAt = undefined;
    toast('已恢复照片', 'success');
  }
}

/** 从回收站彻底删除：内置照片仅移除记录，磁盘照片调用 Rust 删除文件 */
export async function permanentDeletePhoto(id: string) {
  const p = library.photos.find((x) => x.id === id);
  if (!p) return;
  if (p.path && !p.builtin) {
    try {
      await invoke('delete_photos', { paths: [p.path] });
    } catch {
      /* 文件可能已不存在 */
    }
  }
  library.photos = library.photos.filter((x) => x.id !== id);
  toast('已彻底删除', 'success');
}

/** 清空回收站 */
export async function emptyTrash() {
  const trashed = library.photos.filter((p) => p.inTrash);
  const paths = trashed.filter((p) => p.path && !p.builtin).map((p) => p.path);
  if (paths.length) {
    try {
      await invoke('delete_photos', { paths });
    } catch {
      /* 忽略 */
    }
  }
  library.photos = library.photos.filter((p) => !p.inTrash);
  toast('回收站已清空', 'success');
}

/* ── 写真集操作 ─────────────────────────────────────────── */
export function updateAlbum(id: string, patch: Partial<Album>) {
  const a = library.albums.find((x) => x.id === id);
  if (a) Object.assign(a, patch);
}

/* ── 图片查看器 ─────────────────────────────────────────── */
export function openViewer(
  photos: Photo[],
  index: number,
  albumId?: string,
  back?: { label: string; route: string }
) {
  library.viewerContext = { photos: photos.map((p) => ({ ...p })), index, albumId, back };
}

/* ── 导入 ───────────────────────────────────────────────── */
function sanitizeDirName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名写真集';
}

/** 解析待导入图片的宽高（读取真实图片尺寸） */
export function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

export interface ImportPayload {
  files: PendingFile[];
  albumName: string;
  tags: string[];
  targetAlbumId?: string;
}

/**
 * 执行导入：
 * 1. 获取图库目录（不存在则创建）
 * 2. 通过 Rust 命令把文件复制到 <图库>/<写真集>/
 * 3. 建立写真集与照片记录
 */
export async function runImport(payload: ImportPayload): Promise<Album | undefined> {
  if (!payload.files.length) return undefined;
  let libDir = library.settings.storageLocation;
  try {
    libDir = libDir || (await invoke<string>('library_dir'));
  } catch {
    toast('无法访问图库目录', 'error');
    return undefined;
  }
  if (!library.settings.storageLocation) library.settings.storageLocation = libDir;

  const sanitized = sanitizeDirName(payload.albumName);
  const destDir = `${libDir.replace(/[\\/]$/, '')}/${sanitized}`;

  let newPaths: string[] = [];
  try {
    newPaths = await invoke<string[]>('copy_photos', {
      sources: payload.files.map((f) => f.path),
      destDir,
    });
  } catch (e) {
    toast(`导入失败：${String(e)}`, 'error');
    return undefined;
  }

  // 建立/复用写真集
  let album = payload.targetAlbumId
    ? albumById(payload.targetAlbumId)
    : library.albums.find((a) => a.name === payload.albumName);
  const createdAt = Date.now();
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  if (!album) {
    album = {
      id: `album_${Date.now().toString(36)}`,
      name: payload.albumName,
      description: '',
      category: '全部',
      coverSrc: '',
      dateRange: '',
      period: `${now.getFullYear()}.${mm}`,
      createdAt,
    };
    library.albums.push(album);
  }

  const idMap = new Map<string, string>();
  payload.files.forEach((f, i) => {
    const targetPath = newPaths[i] ?? f.path;
    idMap.set(f.path, targetPath);
  });

  const newPhotos: Photo[] = [];
  let lastTakenAt = '';
  for (let i = 0; i < payload.files.length; i++) {
    const f = payload.files[i];
    const targetPath = idMap.get(f.path) ?? f.path;
    lastTakenAt = new Date(f.modified * 1000).toISOString().slice(0, 10);
    newPhotos.push({
      id: `photo_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name.replace(/\.[^.]+$/, ''),
      fileName: f.name,
      path: targetPath,
      src: convertFileSrc(targetPath),
      albumId: album.id,
      tags: payload.tags.filter(Boolean),
      description: '',
      takenAt: lastTakenAt,
      importedAt: Date.now(),
      size: f.size,
      width: f.width,
      height: f.height,
      format: f.format.toUpperCase(),
      isFavorite: false,
      inTrash: false,
      builtin: false,
    });
  }

  // 设置封面
  if (!album.coverSrc && newPhotos.length) album.coverSrc = newPhotos[0].src;
  if (!album.description) {
    album.description = `于 ${now.getFullYear()} 年 ${now.getMonth() + 1} 月导入的写真集。`;
  }
  if (album.dateRange) {
    const start = album.dateRange.split(' — ')[0];
    album.dateRange = `${start} — ${lastTakenAt.replace(/-/g, '.')}`;
  } else {
    const d = (t: Date) => `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
    album.dateRange = `${d(now)} — ${d(new Date(now.getTime() + 86400000 * Math.max(payload.files.length - 1, 0)))}`;
  }

  library.photos.push(...newPhotos);
  toast(`已导入 ${newPhotos.length} 张照片`, 'success');
  return album;
}
