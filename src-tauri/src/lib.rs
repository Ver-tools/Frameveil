use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

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

/// 返回（并创建）缓存目录
#[tauri::command]
fn cache_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
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

/// 返回（并创建）自动备份目录
#[tauri::command]
fn backup_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("Backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// 将文本内容写入指定文件（自动备份图库元数据时使用）
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_file_infos,
            copy_photos,
            write_photo,
            delete_photos,
            library_dir,
            ensure_dir,
            storage_used,
            cache_dir,
            cache_size,
            clear_cache,
            backup_dir,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
