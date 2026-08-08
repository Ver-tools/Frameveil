<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ChevronDown, ExternalLink } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import SegControl from '../components/SegControl.vue';
import { library, toast } from '../store/library';
import { formatBytes } from '../utils/format';

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

const storageUsed = ref(0);

async function refreshStorage() {
  try {
    storageUsed.value = await invoke<number>('storage_used');
  } catch {
    storageUsed.value = 0;
  }
}

const storagePercent = computed(() =>
  Math.min((storageUsed.value / TOTAL_DISK) * 100, 100)
);

function clearCache() {
  toast('缓存已清理', 'success');
}

function checkUpdate() {
  toast('当前已是最新版本', 'success');
}

onMounted(refreshStorage);
</script>

<template>
  <AppShell title="设置">
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
            <div class="chevron-trigger">
              <span>{{ library.settings.language }}</span>
              <ChevronDown :size="16" />
            </div>
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
            <div class="chevron-trigger">
              <span class="truncate">{{ library.settings.storageLocation || '用户/Frameveil/图库' }}</span>
              <ChevronDown :size="16" />
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
            <span class="row-label">清理缓存</span>
            <button class="pill-btn" type="button" @click="clearCache">清理</button>
          </div>
          <div class="setting-row">
            <span class="row-label">自动备份</span>
            <ToggleSwitch v-model="library.settings.autoBackup" label="自动备份" />
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
            <div class="chevron-trigger">
              <span>{{ library.settings.duplicateHandling }}</span>
              <ChevronDown :size="16" />
            </div>
          </div>
          <div class="setting-row">
            <span class="row-label">默认写真集</span>
            <div class="chevron-trigger">
              <span>{{ library.settings.defaultAlbum }}</span>
              <ChevronDown :size="16" />
            </div>
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
            <span class="link-trigger" role="link" tabindex="0" @click="toast('用户协议（示例）', 'info')">
              <ExternalLink :size="16" />
            </span>
          </div>
          <div class="setting-row">
            <span class="row-label">隐私政策</span>
            <span class="link-trigger" role="link" tabindex="0" @click="toast('隐私政策（示例）', 'info')">
              <ExternalLink :size="16" />
            </span>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.page {
  padding: 40px;
  max-width: 680px;
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
  width: 200px;
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
</style>
