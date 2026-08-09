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

/** 照片多选状态（各照片网格共享的瞬时选择） */
export const selection = reactive({
  active: false,
  ids: new Set<string>(),
});

/** 进入 / 退出选择模式 */
export function setSelectMode(active: boolean) {
  selection.active = active;
  if (!active) selection.ids.clear();
}

/** 切换单张照片的选择状态 */
export function toggleSelect(id: string) {
  if (selection.ids.has(id)) selection.ids.delete(id);
  else selection.ids.add(id);
}

/** 全选 / 全不选（传入当前可见照片 id 列表） */
export function selectAllIds(ids: string[]) {
  selection.ids = new Set(ids);
}

/** 清空选择 */
export function clearSelection() {
  selection.ids.clear();
}

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

    // 开启自动备份时，在本地变更稳定后写入备份文件
    if (library.settings.autoBackup && library.settings.lastBackupAt !== lastBackupWritten) {
      window.clearTimeout(backupTimer);
      backupTimer = window.setTimeout(performBackup, 1500);
    }
  },
  { deep: true }
);

/* ── 自动备份 ───────────────────────────────────────────── */
let lastBackupWritten = 0;
let backupTimer: number | undefined;

async function performBackup() {
  try {
    const dir = await invoke<string>('backup_dir');
    const data = JSON.stringify({
      albums: library.albums,
      photos: library.photos,
      settings: library.settings,
      backedAt: Date.now(),
    });
    await invoke('write_text_file', {
      path: `${dir.replace(/[\\/]$/, '')}/library-backup.json`,
      content: data,
    });
    lastBackupWritten = Date.now();
    library.settings.lastBackupAt = lastBackupWritten;
  } catch {
    /* 备份失败静默处理，避免打扰用户 */
  }
}

/** 立即执行一次备份，返回是否成功 */
export async function backupNow(): Promise<boolean> {
  await performBackup();
  return library.settings.lastBackupAt === lastBackupWritten;
}

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

/** 智能相册：直接照片 + 全库中匹配写真集标签的照片；普通写真集仅返回直接照片 */
export function albumPhotosSmart(album: Album): Photo[] {
  if (!album.isSmart) return photosOfAlbum(album.id);
  const tags = album.tags ?? [];
  return library.photos.filter(
    (p) => !p.inTrash && (p.albumId === album.id || (tags.length > 0 && p.tags.some((t) => tags.includes(t))))
  );
}

/** 删除写真集：其照片移入回收站，并移除写真集记录 */
export function deleteAlbum(id: string) {
  const a = albumById(id);
  if (!a) return;
  library.photos.forEach((p) => {
    if (p.albumId === id && !p.inTrash) {
      p.inTrash = true;
      p.trashedAt = Date.now();
    }
  });
  library.albums = library.albums.filter((x) => x.id !== id);
  toast('写真集已删除，照片已移入回收站', 'success');
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

/** 批量收藏 / 取消收藏 */
export function favoritePhotos(ids: Iterable<string>, value = true) {
  let n = 0;
  for (const id of ids) {
    const p = photoById(id);
    if (p && !p.inTrash) {
      p.isFavorite = value;
      n += 1;
    }
  }
  if (n) toast(value ? `已收藏 ${n} 张照片` : `已取消收藏 ${n} 张照片`, 'success');
}

/** 批量移入回收站 */
export function trashPhotos(ids: Iterable<string>) {
  let n = 0;
  for (const id of ids) {
    const p = photoById(id);
    if (p && !p.inTrash) {
      p.inTrash = true;
      p.trashedAt = Date.now();
      n += 1;
    }
  }
  if (n) toast(`已将 ${n} 张照片移入回收站`, 'info');
}

/** 批量添加标签（去重） */
export function addTagsToPhotos(ids: Iterable<string>, tags: string[]) {
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  if (!clean.length) return;
  let n = 0;
  for (const id of ids) {
    const p = photoById(id);
    if (p && !p.inTrash) {
      p.tags = Array.from(new Set([...p.tags, ...clean]));
      n += 1;
    }
  }
  toast(`已为 ${n} 张照片添加标签`, 'success');
}

/** 恢复回收站中的所有照片 */
export function restoreAllTrash() {
  let n = 0;
  library.photos.forEach((p) => {
    if (p.inTrash) {
      p.inTrash = false;
      p.trashedAt = undefined;
      n += 1;
    }
  });
  if (n) toast(`已恢复 ${n} 张照片`, 'success');
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

/** 批量将照片移动到指定写真集（仅修改归属，不移动磁盘文件） */
export function movePhotosToAlbum(ids: Iterable<string>, targetAlbumId: string) {
  const target = albumById(targetAlbumId);
  if (!target) return;
  let n = 0;
  for (const id of ids) {
    const p = photoById(id);
    if (p && !p.inTrash && p.albumId !== targetAlbumId) {
      p.albumId = targetAlbumId;
      n += 1;
    }
  }
  if (n) toast(`已移动 ${n} 张照片到「${target.name}」`, 'success');
}

/** 恢复回收站中选中的照片 */
export function restorePhotos(ids: Iterable<string>) {
  let n = 0;
  for (const id of ids) {
    const p = photoById(id);
    if (p && p.inTrash) {
      p.inTrash = false;
      p.trashedAt = undefined;
      n += 1;
    }
  }
  if (n) toast(`已恢复 ${n} 张照片`, 'success');
}

/** 彻底删除回收站中选中的照片 */
export async function permanentDeletePhotos(ids: Iterable<string>) {
  const list = [...ids].map(photoById).filter((p): p is Photo => Boolean(p));
  if (!list.length) return;
  const paths = list.filter((p) => p.path && !p.builtin).map((p) => p.path);
  if (paths.length) {
    try {
      await invoke('delete_photos', { paths });
    } catch {
      /* 文件可能已不存在 */
    }
  }
  const removeSet = new Set(list.map((p) => p.id));
  library.photos = library.photos.filter((p) => !removeSet.has(p.id));
  toast(`已彻底删除 ${list.length} 张照片`, 'success');
}

/** 将某张照片设为写真集封面 */
export function setAlbumCover(albumId: string, photoSrc: string) {
  const a = albumById(albumId);
  if (!a) return;
  a.coverSrc = photoSrc;
  toast('已设为写真集封面', 'success');
}

/** 将单张照片移动到指定写真集（用于查看器中操作） */
export function movePhotoToAlbum(id: string, targetAlbumId: string) {
  const target = albumById(targetAlbumId);
  const p = photoById(id);
  if (!target || !p) return;
  if (p.albumId === targetAlbumId) {
    toast('该照片已在此写真集中', 'info');
    return;
  }
  p.albumId = targetAlbumId;
  toast(`已移动到「${target.name}」`, 'success');
}

/**
 * 重命名磁盘上的照片文件（仅对有 path 的非内置照片生效）。
 * 同时更新照片记录的 fileName / path / src。
 */
export async function renamePhotoFile(id: string, newFileName: string): Promise<boolean> {
  const p = photoById(id);
  if (!p) return false;
  const trimmed = newFileName.trim();
  if (!trimmed || trimmed === p.fileName) return true;
  if (p.builtin || !p.path) {
    // 内置照片无磁盘文件，仅更新展示用的 fileName
    p.fileName = trimmed;
    return true;
  }
  try {
    const newPath = await invoke<string>('rename_photo', { from: p.path, newName: trimmed });
    p.fileName = trimmed;
    p.path = newPath;
    p.src = convertFileSrc(newPath);
    return true;
  } catch (e) {
    toast(`重命名失败：${String(e)}`, 'error');
    return false;
  }
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
  /** 是否创建智能相册（按标签聚合全库照片） */
  smartAlbum?: boolean;
  /** 是否按写真集分子目录存放（默认 true） */
  autoOrganize?: boolean;
}

/** 设置「重复文件处理」策略到 Rust 命令参数的映射 */
function duplicatePolicy(): string {
  const map: Record<string, string> = { 跳过: 'skip', 覆盖: 'overwrite', 重命名: 'rename' };
  return map[library.settings.duplicateHandling] ?? 'rename';
}

/**
 * 执行导入：
 * 1. 获取存储位置（不存在则创建）
 * 2. 逐文件通过 Rust 命令复制到 <存储位置>/<写真集>/（自动整理关闭时直接复制到根目录）
 * 3. 建立写真集与照片记录；onProgress 回调 (已完成, 总数) 用于展示导入进度
 */
export async function runImport(
  payload: ImportPayload,
  onProgress?: (done: number, total: number) => void
): Promise<Album | undefined> {
  if (!payload.files.length) return undefined;
  let libDir = library.settings.storageLocation;
  try {
    libDir = libDir || (await invoke<string>('library_dir'));
  } catch {
    toast('无法访问存储位置', 'error');
    return undefined;
  }
  if (!library.settings.storageLocation) library.settings.storageLocation = libDir;

  const sanitized = sanitizeDirName(payload.albumName);
  const root = libDir.replace(/[\\/]$/, '');
  const destDir = payload.autoOrganize === false ? root : `${root}/${sanitized}`;
  const onDuplicate = duplicatePolicy();

  // 逐文件复制，便于展示进度并隔离单个文件失败
  const newPaths: string[] = [];
  let failed = 0;
  for (let i = 0; i < payload.files.length; i++) {
    const f = payload.files[i];
    let copiedPath = f.path;
    try {
      const res = await invoke<string[]>('copy_photos', {
        sources: [f.path],
        destDir,
        onDuplicate,
      });
      copiedPath = res[0] ?? f.path;
    } catch {
      failed += 1;
    }
    newPaths.push(copiedPath);
    onProgress?.(i + 1, payload.files.length);
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
      tags: [],
    };
    library.albums.push(album);
  }
  // 智能相册与标签
  album.isSmart = Boolean(payload.smartAlbum);
  if (payload.tags.length) {
    album.tags = Array.from(new Set([...(album.tags ?? []), ...payload.tags]));
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
    album.description =
      album.isSmart && album.tags.length
        ? `智能相册：自动聚合图库中匹配「${album.tags.join('、')}」标签的照片。`
        : `于 ${now.getFullYear()} 年 ${now.getMonth() + 1} 月导入的写真集。`;
  }
  if (album.dateRange) {
    const start = album.dateRange.split(' — ')[0];
    album.dateRange = `${start} — ${lastTakenAt.replace(/-/g, '.')}`;
  } else {
    const d = (t: Date) => `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
    album.dateRange = `${d(now)} — ${d(new Date(now.getTime() + 86400000 * Math.max(payload.files.length - 1, 0)))}`;
  }

  library.photos.push(...newPhotos);
  if (failed > 0) {
    toast(`已导入 ${newPhotos.length - failed} 张照片，${failed} 个文件失败`, 'info');
  } else {
    toast(`已导入 ${newPhotos.length} 张照片`, 'success');
  }
  return album;
}
