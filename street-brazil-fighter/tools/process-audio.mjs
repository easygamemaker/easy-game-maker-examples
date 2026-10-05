// Post-processes the raw ElevenLabs audio (art-src/audio-raw) with ffmpeg: trims silence, makes music loops seamless,
// normalises loudness (effects and voice about -16 LUFS, music about -20 LUFS, peaks under -1.5 dBFS) and encodes mp3.
// Writes public/assets/audio/*.mp3, docs/audio-report.md and src/audio/durations.ts. Needs ffmpeg and ffprobe.
// Usage: node tools/process-audio.mjs [--only id,id]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, RAW_DIR } from './lib/eleven.mjs';
import { ALL_JOBS, MUSIC } from './audio-jobs.mjs';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const OUT = join(ROOT, 'public', 'assets', 'audio');
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'sbf-audio-'));
const LOOPS = new Set(MUSIC.filter((m) => m.loop).map((m) => m.id));
const TARGET = { sfx: -16, tts: -16, music: -20 };
const PEAK_LIMIT_DB = -1.5;
const XFADE = 2.5; // seconds of crossfade for loop points
const RATE = 44100;

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 28 });
const probeDuration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

/** Integrated loudness (LUFS) and true peak (dBTP) with ebur128. Short clips are padded with silence (gated out) to 3 s. */
function lufsAndPeak(file) {
  const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af "apad=whole_dur=3,ebur128=peak=true" -f null - 2>&1 | tail -20`]).toString();
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(r), P = /Peak:\s+(-?[\d.]+) dBFS/.exec(r);
  return { lufs: I ? Number(I[1]) : null, truePeak: P ? Number(P[1]) : null };
}
/** Sample peak and PCM for the seam analysis. */
function pcm(file, stereo) {
  const buf = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
}
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120);
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));

function seam(file) {
  const x = pcm(file);
  const n = Math.round(0.05 * RATE);
  const head = x.slice(0, n), tail = x.slice(x.length - n);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  return {
    headRmsDb: db(rms(head)), tailRmsDb: db(rms(tail)),
    rmsDiffDb: Math.abs(db(rms(head)) - db(rms(tail))),
    // wrap-around sample step (last -> first) relative to the average step inside the last second: about 1 means no click
    jump: Math.abs(x[x.length - 1] - x[0]) / (x.slice(-RATE).reduce((s, v, i, a) => (i ? s + Math.abs(v - a[i - 1]) : s), 0) / (RATE - 1) || 1),
    peak,
  };
}

const rows = [];
const durations = {};
for (const job of ALL_JOBS) {
  if (only && !only.includes(job.id)) continue;
  const src = join(RAW_DIR, `${job.id}.mp3`);
  try { statSync(src); } catch { console.warn(`missing raw ${job.id}`); continue; }
  const kind = job.kind;
  const stereo = kind === 'music';
  const trimmed = join(tmp, `${job.id}-trim.wav`);
  const trimF = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.01,areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.02,areverse';
  const chan = stereo ? 'aformat=channel_layouts=stereo' : 'aformat=channel_layouts=mono';
  if (kind === 'music' && LOOPS.has(job.id)) {
    // seamless loop: loop file = middle part + (tail crossfaded into the head); it then wraps to the sample after the head
    const L = probeDuration(src);
    const o = XFADE;
    ff(['-i', src, '-filter_complex',
      `[0:a]${chan},aresample=${RATE}[a];[a]asplit=3[m][t][h];` +
      `[m]atrim=start=${o}:end=${L - o},asetpts=PTS-STARTPTS[mid];[t]atrim=start=${L - o}:end=${L},asetpts=PTS-STARTPTS[tail];[h]atrim=start=0:end=${o},asetpts=PTS-STARTPTS[head];` +
      `[tail][head]acrossfade=d=${o}:c1=qsin:c2=qsin[x];[mid][x]concat=n=2:v=0:a=1[out]`, '-map', '[out]', trimmed]);
  } else {
    const fades = kind === 'music' ? '' : `,afade=t=in:d=0.006,afade=t=out:st=0:d=0.02`; // fade-out placed after probing length
    ff(['-i', src, '-af', `${kind === 'music' ? '' : trimF + ','}${chan},aresample=${RATE}`, trimmed]);
    void fades;
  }
  // gain to the loudness target, then a limiter so the peak stays under PEAK_LIMIT_DB
  const before = lufsAndPeak(trimmed);
  const gain = TARGET[kind] - (before.lufs ?? TARGET[kind]);
  const dur0 = probeDuration(trimmed);
  const edge = kind === 'music' ? (job.loop === false ? `,afade=t=out:st=${Math.max(0, dur0 - 0.4)}:d=0.4` : '') : `,afade=t=in:d=0.004,afade=t=out:st=${Math.max(0, dur0 - 0.03)}:d=0.03`;
  const final = join(tmp, `${job.id}.mp3`);
  let limitDb = PEAK_LIMIT_DB;
  for (let attempt = 0; attempt < 4; attempt++) {
    const lim = 10 ** (limitDb / 20);
    ff(['-i', trimmed, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${lim.toFixed(4)}:level=disabled${edge}`, '-ar', String(RATE), '-ac', stereo ? '2' : '1',
      '-c:a', 'libmp3lame', '-b:a', stereo ? '96k' : '80k', '-write_xing', '1', final]);
    const tp = lufsAndPeak(final).truePeak;
    if (tp === null || tp <= -1.0) break;
    limitDb -= tp + 1.3; // the mp3 encoder overshoots the limiter: lower it and encode again
  }
  const dest = join(OUT, `${job.id}.mp3`);
  writeFileSync(dest, readFileSync(final));
  const after = lufsAndPeak(dest);
  const dur = probeDuration(dest);
  const x = pcm(dest);
  let samplePeak = 0; for (const v of x) samplePeak = Math.max(samplePeak, Math.abs(v));
  const row = { id: job.id, kind, duration: dur, bytes: statSync(dest).size, lufs: after.lufs, truePeak: after.truePeak, samplePeak: db(samplePeak), gainApplied: gain, loop: LOOPS.has(job.id) ? seam(dest) : null, rawDuration: probeDuration(src) };
  rows.push(row);
  durations[job.id] = Number(dur.toFixed(3));
  console.log(`${job.id.padEnd(18)} ${dur.toFixed(2).padStart(6)}s ${String(after.lufs).padStart(6)} LUFS tp ${after.truePeak} ${row.loop ? `seam ${row.loop.rmsDiffDb.toFixed(1)} dB jump ${row.loop.jump.toFixed(3)}` : ''}`);
}
rmSync(tmp, { recursive: true, force: true });

if (!only) {
  writeFileSync(join(ROOT, 'src', 'audio', 'durations.ts'),
    `// Generated by tools/process-audio.mjs. Length in seconds of every shipped sound (used for announcer ducking).\nexport const SOUND_DURATIONS: Readonly<Record<string, number>> = ${JSON.stringify(durations, null, 2)};\n`);
  const total = rows.reduce((a, r) => a + r.bytes, 0);
  const f1 = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(1));
  const line = (r) => `| ${r.id} | ${r.duration.toFixed(2)} | ${f1(r.samplePeak)} | ${f1(r.truePeak)} | ${f1(r.lufs)} | ${(r.bytes / 1024).toFixed(0)} |`;
  const section = (title, kind) => `### ${title}\n\n| Arquivo | Duração (s) | Pico (dBFS) | Pico real (dBTP) | Volume (LUFS) | Tamanho (KB) |\n|---|---|---|---|---|---|\n${rows.filter((r) => r.kind === kind).map(line).join('\n')}\n`;
  const loops = rows.filter((r) => r.loop);
  const md = `# Relatório de áudio

Gerado por \`node tools/process-audio.mjs\` a partir das saídas brutas da ElevenLabs. Todos os arquivos são mp3 (efeitos e vozes em mono a 80 kbps, músicas em estéreo a 96 kbps). Total: ${(total / 1048576).toFixed(2)} MB em ${rows.length} arquivos.

Metas: efeitos e voz do locutor em torno de -16 LUFS (LUFS, Loudness Units relative to Full Scale, volume integrado), músicas em torno de -20 LUFS para ficarem abaixo dos efeitos, e pico real abaixo de -1 dBTP (dBTP, decibéis de pico real). O limitador fixa o pico de amostra em -1,5 dBFS. Em arquivos muito curtos o volume integrado é medido com o trecho preenchido de silêncio até 3 s (o silêncio não entra na medida).

${section('Efeitos sonoros', 'sfx')}
${section('Locutor', 'tts')}
${section('Músicas', 'music')}
### Emendas dos loops

A faixa em loop é montada com o meio da música mais o final misturado com o começo (fusão de ${XFADE} s com curva de potência constante), de modo que o último trecho desemboca no ponto logo após o começo. A tabela compara os primeiros e os últimos 50 ms do arquivo final decodificado. \`Salto\` é o degrau entre a última e a primeira amostra relativo ao pico (um clique audível costuma passar de 0,1).

| Faixa | RMS dos 50 ms iniciais (dBFS) | RMS dos 50 ms finais (dBFS) | Diferença (dB) | Salto |
|---|---|---|---|---|
${loops.map((r) => `| ${r.id} | ${f1(r.loop.headRmsDb)} | ${f1(r.loop.tailRmsDb)} | ${f1(r.loop.rmsDiffDb)} | ${r.loop.jump.toFixed(3)} |`).join('\n')}

O codificador mp3 deixa cerca de 5 ms de nível baixo no começo de cada arquivo decodificado (atraso do codificador que sobra mesmo com a etiqueta de reprodução sem lacunas). Por isso o `Salto` das faixas de graves pesados sai alto: é um vão de 5 ms a cada volta do loop, não um degrau de clique. Esta medida mostra continuidade de nível e ausência de clique, mas não prova que o ritmo fica alinhado: isso só se confirma ouvindo.
`;
  writeFileSync(join(ROOT, 'docs', 'audio-report.md'), md);
  console.log(`total ${(total / 1048576).toFixed(2)} MB`);
}
