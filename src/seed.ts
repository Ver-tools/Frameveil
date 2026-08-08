import type { Album, Photo } from './types';
import img0 from './assets/demo/image_0_yi19x4.jpg';
import img1 from './assets/demo/image_1_yi19x4.jpg';
import img2 from './assets/demo/image_2_yi19x4.jpg';
import img3 from './assets/demo/image_3_yi19x4.jpg';
import img4 from './assets/demo/image_4_yi19x4.jpg';
import img5 from './assets/demo/image_5_yi19x4.jpg';
import img13 from './assets/demo/image_13_yi19x4.jpg';
import img14 from './assets/demo/image_14_yi19x4.jpg';

/** 内置演示照片：竖图为 3:4，横图为 4:3（与设计文件中 photo-card 的裁切一致） */
export const demoImages: { src: string; name: string; width: number; height: number; size: number }[] = [
  { src: img0, name: '晨光肖像 01', width: 900, height: 1200, size: 197001 },
  { src: img13, name: '素颜之美', width: 900, height: 1200, size: 338913 },
  { src: img2, name: '午后窗边', width: 900, height: 1200, size: 295057 },
  { src: img5, name: '前卫时装', width: 900, height: 1200, size: 350885 },
  { src: img14, name: '悬崖日落', width: 900, height: 1200, size: 354652 },
  { src: img1, name: '黑白侧影', width: 900, height: 1200, size: 450627 },
  { src: img3, name: '山脊日出', width: 1200, height: 900, size: 310971 },
  { src: img4, name: '雨夜街景', width: 1200, height: 900, size: 571611 },
];

/** 每个写真集的拍摄参数（用于填充示例 EXIF 元数据） */
interface AlbumSeed {
  name: string;
  description: string;
  category: string;
  count: number;
  cover: number;
  dateStart: [number, number, number];
  dateEnd: [number, number, number];
  tags: string[];
  camera: string;
  lens: string;
  aperture: string;
  shutter: string;
  iso: string;
  focalLength: string;
}

const albumSeeds: AlbumSeed[] = [
  {
    name: '晨光肖像',
    description: '自然光下的肖像摄影集，记录晨间柔和光线中的人物表情与情绪。',
    category: '人物',
    count: 48,
    cover: 0,
    dateStart: [2024, 3, 15],
    dateEnd: [2024, 3, 28],
    tags: ['人像', '自然光', '室内', '暖色调'],
    camera: 'Canon EOS R5',
    lens: 'RF 85mm f/1.2L',
    aperture: 'f/1.8',
    shutter: '1/200s',
    iso: '400',
    focalLength: '85mm',
  },
  {
    name: '黑白侧影',
    description: '以黑白影调探索轮廓与光影，捕捉侧影中静谧而有力的情绪。',
    category: '黑白',
    count: 32,
    cover: 5,
    dateStart: [2024, 2, 2],
    dateEnd: [2024, 2, 20],
    tags: ['黑白', '肖像', '影调'],
    camera: 'Leica M11',
    lens: 'Summilux 50mm f/1.4',
    aperture: 'f/2',
    shutter: '1/125s',
    iso: '200',
    focalLength: '50mm',
  },
  {
    name: '午后窗边',
    description: '午后阳光透过窗纱洒落，柔和光线勾勒出安静而温暖的室内瞬间。',
    category: '人物',
    count: 56,
    cover: 2,
    dateStart: [2024, 4, 5],
    dateEnd: [2024, 4, 30],
    tags: ['人像', '室内', '自然光'],
    camera: 'Fujifilm X-T5',
    lens: 'XF 56mm f/1.2',
    aperture: 'f/2',
    shutter: '1/160s',
    iso: '320',
    focalLength: '56mm',
  },
  {
    name: '山脊日出',
    description: '山脊之上的日出记录，金色晨光铺满层峦叠嶂，云海翻涌。',
    category: '风景',
    count: 24,
    cover: 6,
    dateStart: [2024, 1, 8],
    dateEnd: [2024, 1, 22],
    tags: ['风景', '日出', '山野'],
    camera: 'Nikon Z8',
    lens: 'Z 24-70mm f/2.8 S',
    aperture: 'f/8',
    shutter: '1/250s',
    iso: '100',
    focalLength: '35mm',
  },
  {
    name: '雨夜街景',
    description: '雨夜霓虹与倒影，街头流动的光影与人间烟火的气息。',
    category: '街拍',
    count: 40,
    cover: 7,
    dateStart: [2024, 5, 10],
    dateEnd: [2024, 5, 26],
    tags: ['街拍', '夜景', '霓虹'],
    camera: 'Sony A7R V',
    lens: 'FE 35mm f/1.4 GM',
    aperture: 'f/2.8',
    shutter: '1/60s',
    iso: '1600',
    focalLength: '35mm',
  },
  {
    name: '前卫时装',
    description: '先锋时装视觉实验，前卫造型与大胆用色在镜头前碰撞。',
    category: '人物',
    count: 36,
    cover: 3,
    dateStart: [2024, 6, 1],
    dateEnd: [2024, 6, 18],
    tags: ['时尚', '人像', '造型'],
    camera: 'Hasselblad X2D',
    lens: 'XCD 90mm f/2.5',
    aperture: 'f/3.2',
    shutter: '1/180s',
    iso: '100',
    focalLength: '90mm',
  },
];

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

function dateInRange(start: [number, number, number], end: [number, number, number], i: number, total: number): string {
  const s = new Date(start[0], start[1] - 1, start[2]).getTime();
  const e = new Date(end[0], end[1] - 1, end[2]).getTime();
  const t = s + ((e - s) * i) / Math.max(total - 1, 1);
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fmtRange(start: [number, number, number], end: [number, number, number]): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${start[0]}.${p(start[1])}.${p(start[2])} — ${end[0]}.${p(end[1])}.${p(end[2])}`;
}

/** 生成内置示例图库（与设计文件中的 6 个写真集一致） */
export function buildSeed(): { albums: Album[]; photos: Photo[] } {
  const albums: Album[] = [];
  const photos: Photo[] = [];

  albumSeeds.forEach((seed, albumIdx) => {
    const albumId = `album_${albumIdx + 1}`;
    const cover = demoImages[seed.cover];
    const base = new Date(2024, albumIdx, 1).getTime();
    albums.push({
      id: albumId,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      coverSrc: cover.src,
      dateRange: fmtRange(seed.dateStart, seed.dateEnd),
      period: `${seed.dateStart[0]}.${String(seed.dateStart[1]).padStart(2, '0')}`,
      createdAt: base,
      tags: [...seed.tags],
    });

    for (let i = 0; i < seed.count; i++) {
      const img = demoImages[i % demoImages.length];
      const takenAt = dateInRange(seed.dateStart, seed.dateEnd, i, seed.count);
      const isThird = albumIdx === 0 && i === 2;
      const photo: Photo = {
        id: nextId('photo'),
        name: isThird ? '午后窗边' : i < demoImages.length ? img.name : `${seed.name} ${String(i + 1).padStart(2, '0')}`,
        fileName: `FV_${seed.name}_${String(i + 1).padStart(3, '0')}.jpg`,
        path: '',
        src: img.src,
        albumId,
        tags: [...seed.tags],
        description: isThird
          ? '午后阳光透过薄纱窗帘洒落在房间里，柔和的光线勾勒出安静而温暖的氛围。'
          : seed.description,
        takenAt,
        importedAt: new Date(`${takenAt}T09:00:00`).getTime(),
        size: img.size,
        width: img.width,
        height: img.height,
        format: 'JPG',
        camera: seed.camera,
        lens: seed.lens,
        aperture: seed.aperture,
        shutter: seed.shutter,
        iso: seed.iso,
        focalLength: seed.focalLength,
        isFavorite: i % 13 === 0,
        inTrash: false,
        builtin: true,
      };
      photos.push(photo);
    }
  });

  return { albums, photos };
}
