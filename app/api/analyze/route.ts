export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { AnalyzeResponseSchema } from '@/lib/types';
import { formatTimecode } from '@/lib/format';

const execFileAsync = promisify(execFile);

async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

async function sceneTimestamps(filePath: string, maxScenes = 14): Promise<number[]> {
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i', filePath, '-filter:v', "select='gt(scene,0.32)',showinfo",
      '-f', 'null', '-',
    ], { maxBuffer: 10 * 1024 * 1024 });
    const times: number[] = [0];
    for (const line of stderr.split('\n')) {
      const m = line.match(/pts_time:([0-9.]+)/);
      if (m) times.push(parseFloat(m[1]));
    }
    const unique = [...new Set(times.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b);
    if (unique.length >= 2) return unique.slice(0, maxScenes);
  } catch {
    /* fall through */
  }
  const dur = await probeDuration(filePath);
  const step = Math.max(4, dur / Math.min(maxScenes, 10));
  const fallback: number[] = [];
  for (let t = 0; t < dur; t += step) fallback.push(t);
  if (!fallback.length) fallback.push(0);
  return fallback;
}

async function grabThumb(filePath: string, sec: number, out: string) {
  await execFileAsync('ffmpeg', [
    '-ss', String(sec), '-i', filePath, '-frames:v', '1',
    '-vf', 'scale=640:-2', '-y', out,
  ], { timeout: 60000 });
}

export async function POST(req: NextRequest) {
  const work = path.join('/tmp', 'aether-' + randomUUID());
  await mkdir(work, { recursive: true });

  try {
    const ct = req.headers.get('content-type') || '';
    let filePath: string | null = null;
    let sourceType: 'video' | 'image' | 'url' = 'video';
    let title = 'Uploaded media';

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const url = form.get('url')?.toString()?.trim();
      if (file && file instanceof Blob && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        const name = (file as File).name || 'upload.bin';
        filePath = path.join(work, name);
        await writeFile(filePath, buf);
        title = name;
        sourceType = file.type.startsWith('image/') ? 'image' : 'video';
      } else if (url) {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error('Could not fetch URL');
        const blob = await res.arrayBuffer();
        const m = url.match(/\.(mp4|webm|mov|m4v)(\?|$)/i);
        const ext = m ? m[1] : 'mp4';
        filePath = path.join(work, `remote.${ext}`);
        await writeFile(filePath, Buffer.from(blob));
        title = new URL(url).hostname;
        sourceType = 'url';
      } else {
        return NextResponse.json({ error: 'Provide a file or URL' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      const url = body?.url?.trim();
      if (!url) return NextResponse.json({ error: 'Provide url in JSON body' }, { status: 400 });
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error('Could not fetch URL');
      const blob = await res.arrayBuffer();
      filePath = path.join(work, 'remote.mp4');
      await writeFile(filePath, Buffer.from(blob));
      title = url;
      sourceType = 'url';
    }

    if (!filePath) return NextResponse.json({ error: 'No input' }, { status: 400 });

    if (sourceType === 'image') {
      const thumb = path.join(work, 'thumb.jpg');
      await execFileAsync('ffmpeg', ['-i', filePath, '-frames:v', '1', '-y', thumb]).catch(() => {});
      let thumbnailUrl: string | undefined;
      try {
        const b = await readFile(thumb);
        thumbnailUrl = `data:image/jpeg;base64,${b.toString('base64')}`;
      } catch { /* */ }
      const payload = AnalyzeResponseSchema.parse({
        sourceType: 'image',
        title,
        scenes: [{
          index: 0,
          timecode: '00:00',
          seconds: 0,
          title: 'Frame 1',
          summary: 'Single-frame image — one scene.',
          thumbnailUrl,
        }],
      });
      return NextResponse.json(payload);
    }

    const duration = await probeDuration(filePath);
    const stamps = await sceneTimestamps(filePath);
    const scenes = [];
    for (let i = 0; i < stamps.length; i++) {
      const sec = stamps[i];
      const thumbPath = path.join(work, `s${i}.jpg`);
      try {
        await grabThumb(filePath, sec, thumbPath);
        const b = await readFile(thumbPath);
        scenes.push({
          index: i,
          timecode: formatTimecode(sec),
          seconds: sec,
          title: i === 0 ? 'Introduction' : `Part ${i + 1}`,
          summary: '',
          thumbnailUrl: `data:image/jpeg;base64,${b.toString('base64')}`,
        });
      } catch {
        scenes.push({
          index: i,
          timecode: formatTimecode(sec),
          seconds: sec,
          title: `Scene ${i + 1}`,
          summary: '',
        });
      }
    }

    const payload = AnalyzeResponseSchema.parse({
      sourceType,
      title,
      durationSeconds: duration,
      scenes,
    });
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Analyze failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
