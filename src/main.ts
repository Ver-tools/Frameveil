import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { initLibrary } from './store/library';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/tokens.css';
import './styles/main.css';

// 先完成图库数据加载（主文件 / 备份 / 迁移）再挂载，避免主题与空状态闪烁
async function bootstrap() {
  await initLibrary();
  createApp(App).use(router).mount('#app');
}

void bootstrap();
