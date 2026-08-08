import { createRouter, createWebHashHistory } from 'vue-router';
import LibraryView from '../views/LibraryView.vue';
import AlbumView from '../views/AlbumView.vue';
import ViewerView from '../views/ViewerView.vue';
import ImportView from '../views/ImportView.vue';
import SettingsView from '../views/SettingsView.vue';
import RecentView from '../views/RecentView.vue';
import FavoritesView from '../views/FavoritesView.vue';
import TagsView from '../views/TagsView.vue';
import TrashView from '../views/TrashView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    { path: '/album/:id', name: 'album', component: AlbumView },
    { path: '/viewer/:pid', name: 'viewer', component: ViewerView },
    { path: '/import', name: 'import', component: ImportView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/recent', name: 'recent', component: RecentView },
    { path: '/favorites', name: 'favorites', component: FavoritesView },
    { path: '/tags', name: 'tags', component: TagsView },
    { path: '/trash', name: 'trash', component: TrashView },
  ],
});
