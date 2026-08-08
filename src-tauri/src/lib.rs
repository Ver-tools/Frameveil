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

/// 将源照片文件复制到目标目录（导入 / 导出磁盘文件时使用），返回复制后的新路径列表
#[tauri::command]
fn copy_photos(sources: Vec<String>, dest_dir: String) -> Result<Vec<String>, String> {
    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let mut copied = Vec::new();
    for src in sources {
        let path = Path::new(&src);
        if !path.exists() {
            continue;
        }
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .ok_or("无效的文件名")?;
        let target = dest.join(&file_name);
        fs::copy(path, &target).map_err(|e| e.to_string())?;
        copied.push(target.to_string_lossy().to_string());
    }
    Ok(copied)
}

/// 将 base64 编码的图片数据写入目标目录（导出内置示例照片时使用）
#[tauri::command]
fn write_photo(dest_dir: String, file_name: String, data: String) -> Result<String, String> {
    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let bytes = BASE64
        .decode(data.as_bytes())
        .map_err(|e| format!("解码失败: {e}"))?;
    let target = dest.join(&file_name);
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

/// 统计图库目录已占用的磁盘空间（字节）
#[tauri::command]
fn storage_used(app: tauri::AppHandle) -> Result<u64, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lib = dir.join("Library");
    if !lib.exists() {
        return Ok(0);
    }
    let mut total: u64 = 0;
    fn walk(d: &Path, total: &mut u64) -> std::io::Result<()> {
        for entry in fs::read_dir(d)? {
            let entry = entry?;
            let p = entry.path();
            if p.is_dir() {
                walk(&p, total)?;
            } else {
                *total += entry.metadata()?.len();
            }
        }
        Ok(())
    }
    walk(&lib, &mut total).map_err(|e| e.to_string())?;
    Ok(total)
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
            storage_used
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
