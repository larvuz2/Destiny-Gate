// FAL job runner. Usage: node tools/fal.mjs <jobs.json> [--only id1,id2] [--force]
// jobs.json: [{ id, endpoint, input, save: { "<json.path>": "<file relative to assets_src/raw>" } }]
// Input values of the form "@file:<path>" are replaced by a data URI (images) or an uploaded URL.
// Input values of the form "@result:<jobId>:<json.path>" are replaced by a value from a previous job's result.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error('FAL_KEY missing');
const ROOT = resolve(import.meta.dirname, '..', 'assets_src');
const RAW = resolve(ROOT, 'raw');
const RES = resolve(ROOT, '_results');
const H = { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

async function fetchRetry(url, opts = {}, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.status >= 500 && i < tries) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(2000 * 2 ** i);
    }
  }
}

export async function upload(file) {
  const buf = readFileSync(file);
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const init = await fetchRetry('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST', headers: H, body: JSON.stringify({ file_name: file.split('/').pop(), content_type: type }),
  });
  if (!init.ok) throw new Error('upload initiate ' + init.status + ' ' + (await init.text()));
  const { upload_url, file_url } = await init.json();
  const put = await fetchRetry(upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: buf });
  if (!put.ok) throw new Error('upload put ' + put.status);
  return file_url;
}

async function resolveInput(v) {
  if (Array.isArray(v)) return Promise.all(v.map(resolveInput));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = await resolveInput(v[k]);
    return o;
  }
  if (typeof v === 'string' && v.startsWith('@file:')) return upload(resolve(ROOT, v.slice(6)));
  if (typeof v === 'string' && v.startsWith('@result:')) {
    const [, id, path] = v.split(':');
    const val = get(JSON.parse(readFileSync(resolve(RES, id + '.json'), 'utf8')), path);
    if (val == null) throw new Error(`missing ${v}`);
    return val;
  }
  return v;
}

export async function run(endpoint, input, log = () => {}) {
  const sub = await fetchRetry(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: H, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`submit ${endpoint} ${sub.status} ${(await sub.text()).slice(0, 400)}`);
  const { status_url, response_url } = await sub.json();
  const t0 = Date.now();
  for (;;) {
    await sleep(3000);
    const st = await (await fetchRetry(status_url, { headers: H })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status !== 'IN_QUEUE' && st.status !== 'IN_PROGRESS') throw new Error(`${endpoint} status ${JSON.stringify(st).slice(0, 300)}`);
    if (Date.now() - t0 > 30 * 60e3) throw new Error(`${endpoint} timeout`);
  }
  const res = await fetchRetry(response_url, { headers: H });
  const body = await res.json();
  if (!res.ok) throw new Error(`${endpoint} result ${res.status} ${JSON.stringify(body).slice(0, 500)}`);
  log(`${endpoint} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return body;
}

async function download(url, file) {
  mkdirSync(dirname(file), { recursive: true });
  const r = await fetchRetry(url);
  if (!r.ok) throw new Error('download ' + r.status + ' ' + url);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

async function runJob(job, force) {
  const resFile = resolve(RES, job.id + '.json');
  const outs = Object.values(job.save || {}).map((f) => resolve(RAW, f));
  let result, state = 'done';
  if (!force && existsSync(resFile)) {
    if (outs.every(existsSync) && !job.saveMaps) return 'cached';
    result = JSON.parse(readFileSync(resFile, 'utf8'));
    state = 'cached';
  } else {
    const input = await resolveInput(job.input);
    result = await run(job.endpoint, input);
    mkdirSync(RES, { recursive: true });
    writeFileSync(resFile, JSON.stringify({ id: job.id, endpoint: job.endpoint, input: job.input, at: new Date().toISOString(), ...result }, null, 1));
  }
  // PBR material sets: one file per predicted map, named <prefix>_<map_type>.png
  for (const im of job.saveMaps ? result.images || [] : []) {
    const f = resolve(RAW, `${job.saveMaps}_${im.map_type || 'src'}.png`);
    if (!existsSync(f)) await download(im.url, f);
  }
  for (const [path, f] of Object.entries(job.save || {})) {
    const v = get(result, path);
    const url = typeof v === 'string' ? v : v?.url;
    if (!url) { console.log(`  ! ${job.id}: nothing at ${path}`); continue; }
    if (state === 'done' || !existsSync(resolve(RAW, f))) await download(url, resolve(RAW, f));
  }
  return state;
}

if (process.argv[1] === import.meta.filename) {
  const args = process.argv.slice(2);
  const jobs = JSON.parse(readFileSync(args[0], 'utf8'));
  const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
  const force = args.includes('--force');
  const conc = args.includes('--conc') ? +args[args.indexOf('--conc') + 1] : 4;
  const queue = jobs.filter((j) => !only || only.has(j.id));
  let fail = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    for (let job; (job = queue.shift()); ) {
      try { console.log(`${job.id}: ${await runJob(job, force)}`); }
      catch (e) { fail++; console.log(`${job.id}: FAILED ${String(e.message).slice(0, 400)}`); }
    }
  }));
  process.exit(fail ? 1 : 0);
}
