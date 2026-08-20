<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ChevronDown, ExternalLink, FolderOpen, RotateCcw, Trash2 } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import SegControl from '../components/SegControl.vue';
import DropdownSelect from '../components/DropdownSelect.vue';
import Modal from '../components/Modal.vue';
import {
  library,
  toast,
  backupNow,
  listBackups,
  deleteBackup,
  restoreBackup,
  type BackupEntry,
} from '../store/library';
import { formatBytes } from '../utils/format';
import { getCacheSize, clearAppCache } from '../utils/cache';
import {
  pickStorageLocation,
  resetStorageLocation,
  refreshStorageUsed,
  storageLocationLabel,
} from '../utils/storage';

const TOTAL_DISK = 256 * 1024 * 1024 * 1024; // 256 GB 参考容量

const themeOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '自动', value: 'auto' },
];
const viewOptions = [
  { label: '网格', value: 'grid' },
  { label: '列表', value: 'list' },
];
const languageOptions = [
  { label: '简体中文', value: '简体中文' },
  { label: 'English', value: 'English' },
  { label: '日本語', value: '日本語' },
];
const duplicateOptions = [
  { label: '跳过', value: '跳过' },
  { label: '覆盖', value: '覆盖' },
  { label: '重命名', value: '重命名' },
];
const defaultAlbumOptions = [
  { label: '按日期创建', value: '按日期创建' },
  { label: '按分类创建', value: '按分类创建' },
  { label: '手动选择', value: '手动选择' },
];

const storageUsed = ref(0);

async function refreshStorage() {
  storageUsed.value = await refreshStorageUsed();
}

const storagePercent = computed(() =>
  Math.min((storageUsed.value / TOTAL_DISK) * 100, 100)
);

function hasCustomLocation(): boolean {
  return Boolean(library.settings.storageLocation);
}

async function onChangeLocation() {
  if (await pickStorageLocation()) refreshStorage();
}

async function onResetLocation() {
  if (await resetStorageLocation()) refreshStorage();
}

/* ── 清理缓存 ── */
const cacheSize = ref(0);

async function refreshCache() {
  cacheSize.value = await getCacheSize();
}

async function onClearCache() {
  const cleared = await clearAppCache();
  await refreshCache();
  toast(cleared > 0 ? `已清理 ${formatBytes(cleared)} 缓存` : '没有需要清理的缓存', 'success');
}

function checkUpdate() {
  toast('当前已是最新版本', 'success');
}

/* ── 自动备份 ── */
const lastBackupLabel = computed(() => {
  const t = library.settings.lastBackupAt;
  if (!t) return '从未备份';
  return fmtTime(t);
});

function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function onBackupNow() {
  const ok = await backupNow();
  toast(ok ? '备份已完成' : '备份失败，请检查存储位置', ok ? 'success' : 'error');
  if (ok) refreshBackups();
}

/* ── 备份列表 / 恢复 / 删除 ── */
const backups = ref<BackupEntry[]>([]);

async function refreshBackups() {
  backups.value = await listBackups();
}

/** 二次确认弹窗（恢复 / 删除备份共用） */
const confirmState = ref<{
  open: boolean;
  title: string;
  body: string;
  danger?: boolean;
  action: (() => Promise<void>) | null;
}>({ open: false, title: '', body: '', action: null });

function askRestore(b: BackupEntry) {
  confirmState.value = {
    open: true,
    title: '恢复备份',
    body: `将把图库整体回滚到 ${fmtTime(b.backedAt)} 的备份状态，当前所有变更（含此后导入的照片记录）会被覆盖。确定恢复吗？`,
    action: async () => {
      const ok = await restoreBackup(b.path);
      if (ok) refreshBackups();
    },
  };
}

function askDelete(b: BackupEntry) {
  confirmState.value = {
    open: true,
    title: '删除备份',
    body: `确定删除 ${fmtTime(b.backedAt)} 的备份文件吗？删除后无法找回。`,
    danger: true,
    action: async () => {
      const ok = await deleteBackup(b.path);
      toast(ok ? '备份已删除' : '删除失败', ok ? 'success' : 'error');
      if (ok) refreshBackups();
    },
  };
}

async function onConfirm() {
  const action = confirmState.value.action;
  confirmState.value.open = false;
  await action?.();
}

/* ── 协议 / 隐私政策弹窗 ── */
const legalOpen = ref(false);
const legalTitle = ref('');
const legalBody = ref('');

function openLegal(title: string, body: string) {
  legalTitle.value = title;
  legalBody.value = body;
  legalOpen.value = true;
}

const agreementBody =
  '欢迎使用 Frameveil 写真照片管理工具。\n\n' +
  '1. 本软件为本地优先的照片管理工具，照片文件默认存储于你的本机目录，你可随时在「设置 → 存储」中更改存储位置。\n' +
  '2. 你导入的照片与元数据仅保存在本地，本软件不会上传、收集或共享你的照片内容。\n' +
  '3. 内置示例照片仅用于功能演示，删除或导出不会影响你的原始文件（内置照片无原始文件）。\n' +
  '4. 使用本软件即表示你同意以上条款。';

const privacyBody =
  '隐私保护说明：\n\n' +
  '· 照片内容：所有照片均在本地处理与存储，不会上传至任何服务器。\n' +
  '· 元数据：拍摄信息（相机、镜头等）仅在你的设备上展示。\n' +
  '· 设置与图库信息：以本地缓存形式保存在你的设备中，可在「设置 → 存储 → 清理缓存」中清除。\n' +
  '· 分析数据：默认关闭，开启后仅在你本机记录匿名使用统计，不会外传。';

onMounted(() => {
  refreshStorage();
  refreshCache();
  refreshBackups();
});
</script>

<template>
  <AppShell>
    <div class="page">
      <h1 class="page-title">设置</h1>

      <!-- 通用 -->
      <section class="section">
        <h2 class="section-label">通用</h2>
        <div class="section-card">
          <div class="setting-row">
            <span class="row-label">外观</span>
            <SegControl v-model="library.settings.theme" :options="themeOptions" />
          </div>
          <div class="setting-row">
            <span class="row-label">语言</span>
            <DropdownSelect
              v-model="library.settings.language"
              :options="languageOptions"
              aria-label="语言"
            />
          </div>
          <div class="setting-row">
            <span class="row-label">默认视图</span>
            <SegControl v-model="library.settings.defaultView" :options="viewOptions" />
          </div>
        </div>
      </section>

      <!-- 存储 -->
      <section class="section">
        <h2 class="section-label">存储</h2>
        <div class="section-card">
          <div class="setting-row">
            <span class="row-label">存储位置</span>
            <div class="location-control">
              <button v-if="hasCustomLocation()" class="pill-btn" type="button" @click="onResetLocation">
                恢复默认
              </button>
              <button class="location-trigger" type="button" title="点击选择新的存储位置" @click="onChangeLocation">
                <FolderOpen :size="15" />
                <span class="truncate">{{ storageLocationLabel() }}</span>
                <ChevronDown :size="16" />
              </button>
            </div>
          </div>
          <div class="setting-row">
            <div>
              <div class="row-label">已用空间</div>
              <div class="row-desc">{{ formatBytes(storageUsed) }} / 256 GB</div>
            </div>
            <div class="progress-track" role="progressbar" :aria-valuenow="storagePercent" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill" :style="{ width: `${storagePercent}%` }"></div>
            </div>
          </div>
          <div class="setting-row">
            <div>
              <div class="row-label">清理缓存</div>
              <div class="row-desc">缓存 {{ formatBytes(cacheSize) }}</div>
            </div>
            <button class="pill-btn" type="button" @click="onClearCache">清理</button>
          </div>
          <div class="setting-row">
            <div>
              <div class="row-label">自动备份</div>
              <div class="row-desc">上次备份：{{ lastBackupLabel }} · 自动保留最近 5 份</div>
            </div>
            <div class="backup-control">
              <button class="pill-btn" type="button" @click="onBackupNow">立即备份</button>
              <ToggleSwitch v-model="library.settings.autoBackup" label="自动备份" />
            </div>
          </div>
          <div v-for="b in backups" :key="b.path" class="setting-row backup-row">
            <div class="backup-info">
              <div class="row-label backup-time">{{ fmtTime(b.backedAt) }}</div>
              <div class="row-desc">{{ formatBytes(b.size) }} · {{ b.name }}</div>
            </div>
            <div class="backup-actions">
              <button class="pill-btn" type="button" @click="askRestore(b)">
                <RotateCcw :size="13" /> 恢复
              </button>
              <button class="pill-btn danger" type="button" @click="askDelete(b)">
                <Trash2 :size="13" /> 删除
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 导入 -->
      <section class="section">
        <h2 class="section-label">导入</h2>
        <div class="section-card">
          <div class="setting-row">
            <span class="row-label">导入后自动整理</span>
            <ToggleSwitch v-model="library.settings.autoOrganize" label="导入后自动整理" />
          </div>
          <div class="setting-row">
            <span class="row-label">重复文件处理</span>
            <DropdownSelect
              v-model="library.settings.duplicateHandling"
              :options="duplicateOptions"
              aria-label="重复文件处理"
            />
          </div>
          <div class="setting-row">
            <span class="row-label">默认写真集</span>
            <DropdownSelect
              v-model="library.settings.defaultAlbum"
              :options="defaultAlbumOptions"
              aria-label="默认写真集"
            />
          </div>
          <div class="setting-row">
            <span class="row-label">保留原始文件</span>
            <ToggleSwitch v-model="library.settings.keepOriginal" label="保留原始文件" />
          </div>
        </div>
      </section>

      <!-- 隐私 -->
      <section class="section">
        <h2 class="section-label">隐私</h2>
        <div class="section-card">
          <div class="setting-row">
            <span class="row-label">面容识别</span>
            <ToggleSwitch v-model="library.settings.faceRecognition" label="面容识别" />
          </div>
          <div class="setting-row">
            <span class="row-label">位置信息</span>
            <ToggleSwitch v-model="library.settings.locationInfo" label="位置信息" />
          </div>
          <div class="setting-row">
            <span class="row-label">分析数据</span>
            <ToggleSwitch v-model="library.settings.analytics" label="分析数据" />
          </div>
        </div>
      </section>

      <!-- 关于 -->
      <section class="section">
        <h2 class="section-label">关于</h2>
        <div class="section-card">
          <div class="setting-row">
            <span class="row-label">版本</span>
            <span class="version-mono">Frameveil 2.4.1 (Build 2841)</span>
          </div>
          <div class="setting-row">
            <span class="row-label">开发者</span>
            <span class="row-value">Frameveil Studio</span>
          </div>
          <div class="setting-row">
            <span class="row-label">检查更新</span>
            <button class="pill-btn" type="button" @click="checkUpdate">检查</button>
          </div>
          <div class="setting-row">
            <span class="row-label">用户协议</span>
            <span class="link-trigger" role="link" tabindex="0" @click="openLegal('用户协议', agreementBody)">
              <ExternalLink :size="16" />
            </span>
          </div>
          <div class="setting-row">
            <span class="row-label">隐私政策</span>
            <span class="link-trigger" role="link" tabindex="0" @click="openLegal('隐私政策', privacyBody)">
              <ExternalLink :size="16" />
            </span>
          </div>
        </div>
      </section>
    </div>

    <!-- 用户协议 / 隐私政策 -->
    <Modal v-if="legalOpen" :title="legalTitle" @close="legalOpen = false">
      <p class="legal-body">{{ legalBody }}</p>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" @click="legalOpen = false">我知道了</button>
      </div>
    </Modal>

    <!-- 恢复 / 删除备份二次确认 -->
    <Modal v-if="confirmState.open" :title="confirmState.title" @close="confirmState.open = false">
      <p class="legal-body">{{ confirmState.body }}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" @click="confirmState.open = false">取消</button>
        <button
          class="btn"
          :class="confirmState.danger ? 'btn-danger' : 'btn-primary'"
          type="button"
          @click="onConfirm"
        >
          确定
        </button>
      </div>
    </Modal>
  </AppShell>
</template>

<style scoped>
.page {
  padding: 40px clamp(20px, 3.2vw, 40px);
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  box-sizing: border-box;
}
.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0 0 32px;
}
.section {
  margin-bottom: 32px;
}
.section-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  margin-bottom: 12px;
  font-weight: 600;
}
.section-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.setting-row:last-child {
  border-bottom: none;
}
.row-label {
  font-size: 14px;
  color: var(--foreground);
  flex-shrink: 0;
}
.row-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.row-value {
  color: var(--muted-foreground);
  font-size: 14px;
}
.chevron-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.18s ease;
  max-width: 60%;
}
.chevron-trigger:hover {
  color: var(--foreground);
}
.chevron-trigger svg {
  flex-shrink: 0;
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.location-control {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 72%;
  min-width: 0;
}
.location-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  background: var(--secondary);
  color: var(--foreground);
  border-radius: 999px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}
.location-trigger:hover {
  background: var(--sidebar-accent);
  border-color: var(--primary);
}
.location-trigger svg {
  flex-shrink: 0;
  color: var(--muted-foreground);
}
.location-trigger .truncate {
  flex: 1;
  min-width: 0;
}
.pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background-color 0.18s ease, filter 0.18s ease;
}
.pill-btn:hover {
  filter: brightness(0.97);
}
.progress-track {
  width: min(200px, 45vw);
  height: 6px;
  border-radius: 3px;
  background: var(--secondary);
  overflow: hidden;
  flex-shrink: 0;
}
.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--primary);
  transition: width 0.3s ease;
}
.link-trigger {
  display: inline-flex;
  align-items: center;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.18s ease;
}
.link-trigger:hover {
  color: var(--foreground);
}
.version-mono {
  font-family: var(--font-mono);
  color: var(--muted-foreground);
  font-size: 13px;
}
.legal-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted-foreground);
  white-space: pre-line;
}
.backup-control {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.backup-row {
  padding-top: 12px;
  padding-bottom: 12px;
}
.backup-row .backup-info {
  min-width: 0;
}
.backup-time {
  font-family: var(--font-mono);
  font-size: 13px;
}
.backup-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.backup-actions .pill-btn {
  gap: 5px;
}
.pill-btn.danger {
  color: var(--destructive);
}
.pill-btn.danger:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
}
.btn-danger {
  background: var(--destructive);
  color: var(--destructive-foreground);
}
.btn-danger:hover {
  filter: brightness(1.05);
}
</style>
