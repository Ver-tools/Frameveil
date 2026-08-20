/** 照片元数据 */
export interface Photo {
  id: string;
  /** 展示名称（标题） */
  name: string;
  /** 原始文件名 */
  fileName: string;
  /** 磁盘绝对路径；内置示例照片为空字符串 */
  path: string;
  /** 可直接用于 <img> 的地址（内置资源 URL 或 convertFileSrc 结果） */
  src: string;
  albumId: string;
  tags: string[];
  description: string;
  /** 拍摄日期 YYYY-MM-DD */
  takenAt: string;
  /** 导入时间戳 */
  importedAt: number;
  /** 字节数 */
  size: number;
  width: number;
  height: number;
  format: string;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  focalLength?: string;
  isFavorite: boolean;
  inTrash: boolean;
  trashedAt?: number;
  /** 是否为内置示例照片 */
  builtin: boolean;
}

/** 写真集 */
export interface Album {
  id: string;
  name: string;
  description: string;
  /** 分类：人物 / 风景 / 街拍 / 黑白 */
  category: string;
  coverSrc: string;
  /** 拍摄时间段，如 2024.03.15 — 2024.03.28 */
  dateRange: string;
  /** 期号，如 2024.03 */
  period: string;
  createdAt: number;
  /** 写真集标签（智能相册按标签聚合照片） */
  tags: string[];
  /** 是否为智能相册：自动聚合全库中匹配标签的照片 */
  isSmart?: boolean;
}

/** 应用设置 */
export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultView: 'grid' | 'list';
  storageLocation: string;
  autoOrganize: boolean;
  smartAlbum: boolean;
  autoBackup: boolean;
  duplicateHandling: '跳过' | '覆盖' | '重命名';
  defaultAlbum: string;
  keepOriginal: boolean;
  faceRecognition: boolean;
  locationInfo: boolean;
  analytics: boolean;
  /** 上次自动备份时间戳 */
  lastBackupAt?: number;
}

/** 导入预览中的待导入文件 */
export interface PendingFile {
  path: string;
  name: string;
  size: number;
  modified: number;
  src: string;
  width: number;
  height: number;
  format: string;
}

/** EXIF 解析摘要（read_exif_batch 返回；无法解析的字段为 null） */
export interface ExifInfo {
  takenAt: string | null;
  camera: string | null;
  lens: string | null;
  aperture: string | null;
  shutter: string | null;
  iso: string | null;
  focalLength: string | null;
}
