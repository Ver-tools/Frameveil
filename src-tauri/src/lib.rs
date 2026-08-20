use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use exif::{In, Reader, Tag, Value};
use image::DynamicImage;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

/// 单个文件的元信息（用于导入前的文件列表展示）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    path: String,
    name: String,
    size: u64,
    modified: u64,
}

/// 批量读取文件的元信息
#[tauri::command]
fn get_file_infos(paths: Vec<String>) -> Result<Vec<FileInfo>, String> {
    let mut out = Vec::new();
    for p in paths {
        let path = PathBuf::from(&p);
        let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        out.push(FileInfo {
            path: p,
            name,
            size: meta.len(),
            modified,
        });
    }
    Ok(out)
}

/// 校验并确保目录存在且可写（选择存储位置时使用），返回规范化路径
#[tauri::command]
fn ensure_dir(path: String) -> Result<String, String> {
    let dir = PathBuf::from(&path);
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建目录：{e}"))?;
    // 写入探针文件验证可写性
    let probe = dir.join(".frameveil_write_probe");
    fs::write(&probe, b"ok").map_err(|e| format!("目录不可写：{e}"))?;
    let _ = fs::remove_file(&probe);
    Ok(dir.to_string_lossy().to_string())
}

/// 生成不冲突的目标文件路径：同名文件自动追加 (1)、(2)…
fn unique_target(dest: &Path, file_name: &str) -> PathBuf {
    let target = dest.join(file_name);
    if !target.exists() {
        return target;
    }
    let stem = Path::new(file_name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let ext = Path::new(file_name)
        .extension()
        .map(|e| e.to_string_lossy().to_string());
    let mut i = 1;
    loop {
        let candidate = match &ext {
            Some(e) => format!("{stem} ({i}).{e}"),
            None => format!("{stem} ({i})"),
        };
        let p = dest.join(&candidate);
        if !p.exists() {
            return p;
        }
        i += 1;
    }
}

/// 将源照片文件复制到目标目录（导入 / 导出磁盘文件时使用），返回复制后的新路径列表。
/// 自动创建目标目录；`on_duplicate` 控制同名文件的处理策略：
///   - "skip"：跳过并复用已存在的文件
///   - "overwrite"：覆盖已存在的文件
///   - 其他（默认 "rename"）：自动追加 (1)、(2)… 重命名，避免覆盖
#[tauri::command]
fn copy_photos(
    sources: Vec<String>,
    dest_dir: String,
    on_duplicate: Option<String>,
) -> Result<Vec<String>, String> {
    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let policy = on_duplicate.unwrap_or_else(|| "rename".to_string());
    let mut copied = Vec::new();
    for src in sources {
        let path = Path::new(&src);
        if !path.exists() {
            // 源文件不存在：保持原路径，交由前端自行处理
            copied.push(src.clone());
            continue;
        }
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .ok_or("无效的文件名")?;
        let direct = dest.join(&file_name);
        let target = if direct.exists() {
            match policy.as_str() {
                "skip" => {
                    copied.push(direct.to_string_lossy().to_string());
                    continue;
                }
                "overwrite" => direct,
                _ => unique_target(&dest, &file_name),
            }
        } else {
            direct
        };
        fs::copy(path, &target).map_err(|e| e.to_string())?;
        copied.push(target.to_string_lossy().to_string());
    }
    Ok(copied)
}

/// 将 base64 编码的图片数据写入目标目录（导出内置示例照片时使用），同名文件自动重命名
#[tauri::command]
fn write_photo(dest_dir: String, file_name: String, data: String) -> Result<String, String> {
    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let bytes = BASE64
        .decode(data.as_bytes())
        .map_err(|e| format!("解码失败: {e}"))?;
    let target = unique_target(&dest, &file_name);
    fs::write(&target, bytes).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

/// 物理删除照片文件
#[tauri::command]
fn delete_photos(paths: Vec<String>) -> Result<(), String> {
    for p in paths {
        let path = Path::new(&p);
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 重命名磁盘上的照片文件（保持同目录），返回新路径。
/// 目标文件名已存在时直接报错，由前端处理冲突策略。
#[tauri::command]
fn rename_photo(from: String, new_name: String) -> Result<String, String> {
    let path = Path::new(&from);
    if !path.exists() {
        return Err("源文件不存在".to_string());
    }
    let dir = path.parent().ok_or_else(|| "无效的文件路径".to_string())?;
    let target = dir.join(&new_name);
    if target.exists() && target != path {
        return Err("目标文件名已存在".to_string());
    }
    fs::rename(path, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

/// 返回（并创建）Frameveil 图库根目录：<AppData>/Frameveil/Library
#[tauri::command]
fn library_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lib = dir.join("Library");
    fs::create_dir_all(&lib).map_err(|e| e.to_string())?;
    Ok(lib.to_string_lossy().to_string())
}

/// 递归统计目录占用空间（字节）
fn dir_size(d: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(rd) = fs::read_dir(d) {
        for entry in rd.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(meta) = entry.metadata() {
                total += meta.len();
            }
        }
    }
    total
}

/// 统计指定目录（未指定时统计默认图库目录）已占用的磁盘空间（字节）
#[tauri::command]
fn storage_used(app: tauri::AppHandle, path: Option<String>) -> Result<u64, String> {
    let dir = match path {
        Some(p) => PathBuf::from(p),
        None => app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("Library"),
    };
    Ok(dir_size(&dir))
}

/// 统计缓存目录占用空间（字节）
#[tauri::command]
fn cache_size(app: tauri::AppHandle) -> Result<u64, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    Ok(dir_size(&dir))
}

/// 清空缓存目录，返回本次清理的字节数
#[tauri::command]
fn clear_cache(app: tauri::AppHandle) -> Result<u64, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    if !dir.exists() {
        return Ok(0);
    }
    let mut cleared: u64 = 0;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let p = entry.map_err(|e| e.to_string())?.path();
        if p.is_dir() {
            cleared += dir_size(&p);
            fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
        } else if p.is_file() {
            cleared += fs::metadata(&p).map_err(|e| e.to_string())?.len();
            fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }
    Ok(cleared)
}

/* ── 图库元数据持久化 ─────────────────────────────────────── */

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 原子写：先写临时文件再重命名，避免写入中断导致文件损坏
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// 返回图库元数据主文件路径 <AppData>/Frameveil/library.json（确保目录存在）
#[tauri::command]
fn library_file(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("library.json").to_string_lossy().to_string())
}

/// 读取文本文件；文件不存在时返回 null
#[tauri::command]
fn read_text_file(path: String) -> Result<Option<String>, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(None);
    }
    fs::read_to_string(p).map(Some).map_err(|e| e.to_string())
}

/// 原子写入文本文件（图库元数据持久化时使用）
#[tauri::command]
fn write_text_file_atomic(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), &content)
}

/// 删除单个文件（管理备份文件时使用）
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/* ── 备份轮换 ─────────────────────────────────────────────── */

const KEEP_BACKUPS: usize = 5;

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("Backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// 备份文件条目（前端列表展示 / 恢复用）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    name: String,
    path: String,
    size: u64,
    backed_at: u64,
}

/// 收集备份文件（含旧版固定名备份），按备份时间倒序
fn collect_backups(dir: &Path) -> Vec<BackupInfo> {
    let mut list: Vec<BackupInfo> = Vec::new();
    if let Ok(rd) = fs::read_dir(dir) {
        for entry in rd.flatten() {
            let p = entry.path();
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if !(name.starts_with("library-backup") && name.ends_with(".json")) {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            // 优先用文件名中的时间戳，旧版固定名备份回退到文件修改时间
            let ts_from_name = name
                .strip_prefix("library-backup-")
                .and_then(|s| s.strip_suffix(".json"))
                .and_then(|s| s.parse::<u64>().ok());
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            list.push(BackupInfo {
                name,
                path: p.to_string_lossy().to_string(),
                size: meta.len(),
                backed_at: ts_from_name.unwrap_or(modified),
            });
        }
    }
    list.sort_by(|a, b| b.backed_at.cmp(&a.backed_at));
    list
}

/// 列出可用备份（按时间倒序）
#[tauri::command]
fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    Ok(collect_backups(&backups_dir(&app)?))
}

/// 写入一份带时间戳的备份，并轮换只保留最近 5 份；返回备份文件路径
#[tauri::command]
fn write_backup(app: tauri::AppHandle, content: String) -> Result<String, String> {
    let dir = backups_dir(&app)?;
    let target = dir.join(format!("library-backup-{}.json", now_ms()));
    atomic_write(&target, &content)?;
    for old in collect_backups(&dir).iter().skip(KEEP_BACKUPS) {
        let _ = fs::remove_file(&old.path);
    }
    Ok(target.to_string_lossy().to_string())
}

/* ── EXIF 解析 ────────────────────────────────────────────── */

/// 照片 EXIF 摘要（字段无法解析时为 null）
#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExifInfo {
    pub taken_at: Option<String>,
    pub camera: Option<String>,
    pub lens: Option<String>,
    pub aperture: Option<String>,
    pub shutter: Option<String>,
    pub iso: Option<String>,
    pub focal_length: Option<String>,
}

/// 读取 ASCII 型 EXIF 字段（相机 / 镜头型号等）
fn exif_ascii(exif: &exif::Exif, tag: Tag) -> Option<String> {
    let s = exif.get_field(tag, In::PRIMARY)?.display_value().to_string();
    let s = s
        .trim()
        .trim_matches('"')
        .trim_end_matches('\0')
        .trim()
        .to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// 读取数值型 EXIF 字段（光圈 / 快门 / ISO / 焦距等）
fn exif_number(exif: &exif::Exif, tag: Tag) -> Option<f64> {
    let f = exif.get_field(tag, In::PRIMARY)?;
    match &f.value {
        Value::Rational(v) => v.first().map(|r| r.to_f64()),
        Value::SRational(v) => v.first().map(|r| r.to_f64()),
        Value::Short(v) => v.first().map(|&x| x as f64),
        Value::Long(v) => v.first().map(|&x| x as f64),
        _ => None,
    }
}

/// 数值格式化：保留最多 digits 位小数并去掉尾随零
fn format_trim(v: f64, digits: usize) -> String {
    let s = format!("{v:.digits$}");
    let s = s.trim_end_matches('0').trim_end_matches('.');
    if s.is_empty() {
        "0".to_string()
    } else {
        s.to_string()
    }
}

/// 解析单张照片的 EXIF 摘要；无法解析时返回全空字段
fn parse_exif(path: &Path) -> ExifInfo {
    let mut info = ExifInfo::default();
    let Ok(file) = fs::File::open(path) else {
        return info;
    };
    let Ok(exif) = Reader::new().read_from_container(&mut BufReader::new(file)) else {
        return info;
    };

    // 拍摄日期：优先 DateTimeOriginal，回退 DateTime
    for tag in [Tag::DateTimeOriginal, Tag::DateTime] {
        if let Some(f) = exif.get_field(tag, In::PRIMARY) {
            let s = f.display_value().to_string();
            if let Some(date) = s.split_whitespace().next() {
                let date = date.replace(':', "-");
                if date.len() == 10 {
                    info.taken_at = Some(date);
                    break;
                }
            }
        }
    }

    info.camera = exif_ascii(&exif, Tag::Model).or_else(|| exif_ascii(&exif, Tag::Make));
    info.lens = exif_ascii(&exif, Tag::LensModel);

    if let Some(f) = exif_number(&exif, Tag::FNumber) {
        info.aperture = Some(format!("f/{}", format_trim(f, 2)));
    }
    if let Some(t) = exif_number(&exif, Tag::ExposureTime) {
        info.shutter = if t > 0.0 && t < 1.0 {
            Some(format!("1/{}s", format_trim(1.0 / t, 0)))
        } else {
            Some(format!("{}s", format_trim(t, 1)))
        };
    }
    // ISO：优先经典 0x8827（PhotographicSensitivity），回退新式 0x8833（ISOSpeed）
    if let Some(iso) = exif_number(&exif, Tag::PhotographicSensitivity)
        .or_else(|| exif_number(&exif, Tag::ISOSpeed))
    {
        info.iso = Some(format!("{}", iso as u64));
    }
    if let Some(fl) = exif_number(&exif, Tag::FocalLength) {
        info.focal_length = Some(format!("{}mm", format_trim(fl, 1)));
    }
    info
}

/// 批量解析照片 EXIF；单个文件失败不影响其他（顺序与入参一致）
#[tauri::command]
fn read_exif_batch(paths: Vec<String>) -> Vec<ExifInfo> {
    paths.iter().map(|p| parse_exif(Path::new(p))).collect()
}

/* ── 缩略图生成 ───────────────────────────────────────────── */

/// 缩略图缓存的文件数上限：超过 HIGH 清理到 LOW（按修改时间删最旧）
const THUMB_HIGH: usize = 4000;
const THUMB_LOW: usize = 2500;
/// 每 N 次调用做一次 LRU 检查
const THUMB_CHECK_EVERY: u32 = 256;
static THUMB_CALLS: AtomicU32 = AtomicU32::new(0);

fn thumbs_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// 缓存键：路径 + 修改时间 + 大小 + 尺寸参数哈希，源文件变化自然失效
fn thumb_hash(path: &str, mtime_ms: u128, size: u64, max_dim: u32) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    mtime_ms.hash(&mut h);
    size.hash(&mut h);
    max_dim.hash(&mut h);
    h.finish()
}

/// 按 EXIF Orientation（1-8）旋转图片，避免手机照片缩略图方向错误
fn apply_orientation(img: DynamicImage, orient: u32) -> DynamicImage {
    match orient {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        6 => img.rotate90(),
        7 => img.rotate270().fliph(),
        8 => img.rotate270(),
        _ => img,
    }
}

fn read_orientation(path: &Path) -> u32 {
    let Ok(file) = fs::File::open(path) else {
        return 1;
    };
    match Reader::new().read_from_container(&mut BufReader::new(file)) {
        Ok(exif) => exif
            .get_field(Tag::Orientation, In::PRIMARY)
            .and_then(|f| match &f.value {
                Value::Short(v) => v.first().map(|&x| x as u32),
                _ => None,
            })
            .filter(|&o| (1..=8).contains(&o))
            .unwrap_or(1),
        Err(_) => 1,
    }
}

/// LRU 清理：超过 THUMB_HIGH 时按修改时间删最旧至 THUMB_LOW
fn thumbs_prune(dir: &Path) {
    let mut entries: Vec<(PathBuf, u64)> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            Some((e.path(), modified))
        })
        .collect();
    if entries.len() <= THUMB_HIGH {
        return;
    }
    entries.sort_by_key(|(_, m)| *m);
    let drop_n = entries.len() - THUMB_LOW;
    for (p, _) in entries.into_iter().take(drop_n) {
        let _ = fs::remove_file(p);
    }
}

/// 生成或获取缩略图（返回缓存文件路径，供前端 convertFileSrc 加载）。
/// 不支持的格式（RAW / HEIC 等）返回 None，由前端回退原图。
#[tauri::command]
async fn get_thumbnail(
    app: tauri::AppHandle,
    path: String,
    max_dim: Option<u32>,
) -> Result<Option<String>, String> {
    let max_dim = max_dim.unwrap_or(480).clamp(64, 1600);
    let src = PathBuf::from(&path);
    let meta = match fs::metadata(&src) {
        Ok(m) => m,
        Err(_) => return Ok(None),
    };
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let size = meta.len();

    let dir = thumbs_dir(&app)?;
    let key = thumb_hash(&path, mtime_ms, size, max_dim);
    let target = dir.join(format!("{key:016x}.jpg"));

    // 缓存命中：刷新访问时间并直接返回
    if target.exists() {
        let _ = filetime_refresh(&target);
        maybe_prune(&dir);
        return Ok(Some(target.to_string_lossy().to_string()));
    }

    // 缩略图生成是 CPU 密集操作，放到阻塞线程池执行
    let target_clone = target.clone();
    let generated = tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let orientation = read_orientation(&src);
        let img = image::open(&src).map_err(|e| e.to_string())?;
        let img = apply_orientation(img, orientation);
        let thumb = img.thumbnail(max_dim, max_dim);
        let mut buf = std::io::Cursor::new(Vec::new());
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 82);
        thumb
            .write_with_encoder(encoder)
            .map_err(|e| e.to_string())?;
        fs::write(&target_clone, buf.into_inner()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    match generated {
        Ok(()) => {
            maybe_prune(&dir);
            Ok(Some(target.to_string_lossy().to_string()))
        }
        // 解码失败（格式不支持）→ 前端回退原图
        Err(_) => Ok(None),
    }
}

/// 更新文件修改时间，用于 LRU 按最近访问排序
fn filetime_refresh(path: &Path) -> std::io::Result<()> {
    let now = SystemTime::now();
    let f = fs::OpenOptions::new().write(true).open(path)?;
    f.set_times(fs::FileTimes::new().set_modified(now))
}

fn maybe_prune(dir: &Path) {
    let n = THUMB_CALLS.fetch_add(1, Ordering::Relaxed);
    if n % THUMB_CHECK_EVERY == 0 {
        thumbs_prune(dir);
    }
}

/* ── 批量复制（导入）与进度推送 ───────────────────────────── */

/// 复制进度事件载荷
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CopyProgress {
    pub done: usize,
    pub total: usize,
    pub file_name: String,
}

/// 批量复制结果：目标路径（失败项为空字符串）+ 失败索引
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyBatchResult {
    pub copied: Vec<String>,
    pub failed: Vec<usize>,
}

/// 批量复制源文件到目标目录，逐文件通过 progress_event 推送进度。
/// 单文件失败不中断批次，失败索引记录在 failed 中。
#[tauri::command]
async fn copy_photos_batch(
    app: tauri::AppHandle,
    sources: Vec<String>,
    dest_dir: String,
    on_duplicate: Option<String>,
    progress_event: String,
) -> Result<CopyBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let total = sources.len();
        let dest = PathBuf::from(&dest_dir);
        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        let policy = on_duplicate.unwrap_or_else(|| "rename".to_string());

        let mut copied: Vec<String> = Vec::with_capacity(total);
        let mut failed: Vec<usize> = Vec::new();

        for (i, src) in sources.iter().enumerate() {
            let file_name = Path::new(src)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let _ = app.emit(
                &progress_event,
                CopyProgress {
                    done: i,
                    total,
                    file_name: file_name.clone(),
                },
            );

            let path = Path::new(src);
            if !path.exists() {
                failed.push(i);
                copied.push(String::new());
                continue;
            }
            let direct = dest.join(&file_name);
            let target = if direct.exists() {
                match policy.as_str() {
                    "skip" => {
                        copied.push(direct.to_string_lossy().to_string());
                        continue;
                    }
                    "overwrite" => direct,
                    _ => unique_target(&dest, &file_name),
                }
            } else {
                direct
            };
            match fs::copy(path, &target) {
                Ok(_) => copied.push(target.to_string_lossy().to_string()),
                Err(_) => {
                    failed.push(i);
                    copied.push(String::new());
                }
            }
        }

        let _ = app.emit(
            &progress_event,
            CopyProgress {
                done: total,
                total,
                file_name: String::new(),
            },
        );
        Ok(CopyBatchResult { copied, failed })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_file_infos,
            copy_photos,
            copy_photos_batch,
            write_photo,
            delete_photos,
            rename_photo,
            library_dir,
            library_file,
            read_text_file,
            write_text_file_atomic,
            delete_file,
            list_backups,
            write_backup,
            read_exif_batch,
            get_thumbnail,
            ensure_dir,
            storage_used,
            cache_size,
            clear_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
