#!/usr/bin/env node
import fs from 'node:fs/promises';
import {openSync, closeSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createWriteStream, createReadStream} from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(here, 'release.json')));
const platform = `${process.platform}-${process.arch}`;
const home = os.homedir();
const appData = path.resolve(process.env.STRATEGY_LAB_HOME || (process.platform === 'darwin'
  ? path.join(home, 'Library/Application Support/StrategyLab')
  : process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'StrategyLab')
  : path.join(process.env.XDG_DATA_HOME || path.join(home, '.local/share'), 'strategy-lab')));
const cache = path.resolve(process.env.SONIC_LAB_CACHE || path.join(home, '.cache/sonic-trading-lab'));
const origin = `http://127.0.0.1:${process.env.STRATEGY_LAB_PORT || '8091'}`;
const expected = createHash('sha256').update(appData).digest('hex').slice(0, 16);
const executables = {'darwin-arm64': 'StrategyLab.app/Contents/MacOS/StrategyLab'};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let lock;

function older(a, b) {
  const split = v => {const i=v.indexOf('-');return i<0?[v,null]:[v.slice(0,i),v.slice(i+1)];};
  const [ac,ap]=split(a),[bc,bp]=split(b);
  const aa=ac.split('.').map(Number),bb=bc.split('.').map(Number);
  for(let i=0;i<3;i++) if(aa[i]!==bb[i]) return aa[i]<bb[i];
  if(ap===bp || bp===null) return ap!==bp && ap!==null;
  if(ap===null) return false;
  const x=ap.split('.'),y=bp.split('.');
  for(let i=0;i<Math.max(x.length,y.length);i++) {
    if(x[i]===undefined)return true;if(y[i]===undefined)return false;
    if(x[i]===y[i])continue;
    const xn=/^\d+$/.test(x[i]),yn=/^\d+$/.test(y[i]);
    return xn&&yn?Number(x[i])<Number(y[i]):xn!==yn?xn:x[i]<y[i];
  }
  return false;
}

function trustedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
    throw Error('Release URLs must use HTTPS (localhost HTTP is allowed for verification).');
  return url;
}
async function fetchSafe(value, timeout = 15000) {
  let url = trustedUrl(value);
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, {redirect:'manual', signal:AbortSignal.timeout(timeout)});
    if ([301,302,303,307,308].includes(r.status)) { url = trustedUrl(new URL(r.headers.get('location'), url)); continue; }
    if (!r.ok) throw Error(`Download returned HTTP ${r.status}`);
    return r;
  }
  throw Error('Too many download redirects');
}
async function health() {
  let r;
  try { r = await fetch(`${origin}/api/health`, {signal:AbortSignal.timeout(1500)}); }
  catch (e) { if (e.cause?.code === 'ECONNREFUSED') return false; throw Error(`Cannot safely check ${origin}: ${e.message}`); }
  let h; try { h = await r.json(); } catch { throw Error('Port is occupied by another application.'); }
  if (h.app !== 'strategy-lab' || h.workspace !== expected) throw Error('Port is occupied by another application or a different data folder. Quit that app first.');
  return true;
}
function browser() {
  if (process.env.SONIC_LAB_NO_BROWSER === '1') return;
  const p = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [origin], {stdio:'ignore', detached:true});
  p.on('error', () => console.log(`Open ${origin}`)); p.unref();
}
async function readActive() {
  try {
    const a = JSON.parse(await fs.readFile(path.join(cache, 'active.json')));
    if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(a.version) || !/^[a-f0-9]{64}$/.test(a.sha256)) throw Error('Invalid cached release');
    await fs.access(binary(a)); return a;
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function directory(a) { return path.join(cache, 'versions', `${a.version}-${a.sha256}`); }
function binary(a) { return path.join(directory(a), executables[platform]); }
async function start(a) {
  const log = openSync(path.join(cache, 'launcher.log'), 'a');
  const child = spawn(binary(a), [], {detached:true, stdio:['ignore',log,log], env:{...process.env, STRATEGY_LAB_HOME:appData, ...(process.env.SONIC_LAB_NO_BROWSER === '1' ? {BROWSER:'/usr/bin/true'} : {})}});
  closeSync(log);
  let failure; child.on('error', e => {failure=e;}); child.unref();
  for (let i=0; i<120; i++) {
    if (failure) throw failure;
    if (child.exitCode !== null) throw Error(`Application exited ${child.exitCode}; see ${cache}/launcher.log`);
    if (await health()) return;
    await delay(250);
  }
  // Never start a second version if this process may still be starting.
  throw Error(`Startup was not confirmed. See ${cache}/launcher.log; no second app was launched.`);
}
async function install(a) {
  const dir = directory(a);
  try { await fs.access(binary(a)); return; } catch {}
  const stage = await fs.mkdtemp(path.join(cache, 'download-'));
  try {
    console.log(`Downloading sonic-trading-lab ${a.version}…`);
    const zip = path.join(stage, 'app.zip');
    const r = await fetchSafe(a.url, 300000);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(zip));
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(zip)) hash.update(chunk);
    if (hash.digest('hex') !== a.sha256) throw Error('Release checksum mismatch; update rejected.');
    const unpack = path.join(stage, 'unpacked'); await fs.mkdir(unpack);
    execFileSync('/usr/bin/ditto', ['-x','-k',zip,unpack], {stdio:'pipe'});
    await fs.access(path.join(unpack, executables[platform]));
    await fs.mkdir(path.dirname(dir), {recursive:true}); await fs.rename(unpack, dir);
  } finally { await fs.rm(stage, {recursive:true, force:true}); }
}
async function acquire() {
  const file = path.join(cache, 'launch.lock');
  for (let i=0;i<2;i++) {
    try { lock=await fs.open(file,'wx'); await lock.writeFile(String(process.pid)); return; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(await fs.readFile(file,'utf8'));
      if (!Number.isInteger(pid) || pid<=0) throw Error('Launcher lock is incomplete. Try again shortly.');
      try {process.kill(pid,0);} catch (error) {
        if (error.code === 'ESRCH') {await fs.unlink(file); continue;}
        throw error;
      }
      throw Error('Another sonic-trading-lab launch/update is already in progress.');
    }
  }
  throw Error('Could not acquire launcher lock');
}
async function main() {
  if (process.argv.includes('--help')) { console.log('sonic-trading-lab: check for an update, then open the local dashboard. Quit app in the dashboard before updating.'); return; }
  const manifestUrl = process.env.SONIC_LAB_RELEASE_URL || config.manifestUrl;
  if (process.argv.includes('--check-release')) {
    if (!config.manifestUrl || trustedUrl(config.manifestUrl).protocol !== 'https:') throw Error('Publish blocked: configure the official HTTPS release manifest first.');
    return;
  }
  if (!executables[platform]) throw Error(`${platform} has no verified npm release yet. Apple Silicon macOS is the initial beta target.`);
  await fs.mkdir(cache,{recursive:true}); await acquire();
  if (await health()) {console.log('Already running; opening the existing app. Updates wait until you quit and relaunch.'); browser(); return;}
  const active = await readActive(); let next;
  try {
    if (!manifestUrl) throw Error('Official release hosting is not configured; this npm package is not published yet.');
    const m = await (await fetchSafe(manifestUrl)).json();
    const asset = m.platforms?.[platform];
    if (m.schema !== 1 || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(m.version) || !asset || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw Error('Invalid or unsupported release manifest');
    next = {version:m.version,sha256:asset.sha256,url:String(trustedUrl(asset.url))};
    if (active && older(next.version, active.version)) throw Error('Release manifest is older than the installed version; refusing downgrade.');
    if (active?.version === next.version && active.sha256 !== next.sha256) throw Error('Published release changed without a new version; refusing update.');
    await install(next);
  } catch (e) {
    if (!active) throw e;
    console.warn(`Update unavailable: ${e.message}\nOpening the last working version ${active.version}.`); next=active;
  }
  await start(next);
  const temp=path.join(cache,'active.json.tmp'); await fs.writeFile(temp,JSON.stringify(next));
  await fs.rename(temp,path.join(cache,'active.json'));
  console.log(`sonic-trading-lab ${next.version} ready at ${origin}`);
}
try {await main();} catch (e) {console.error(e.message); process.exitCode=1;}
finally {if(lock){await lock.close();await fs.unlink(path.join(cache,'launch.lock')).catch(()=>{});}}
