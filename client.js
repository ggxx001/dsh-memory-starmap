window.__ModuleLoader__.load({
  id: '@local/dsh-memory-starmap',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    const API = 'http://127.0.0.1:8801/api/all';
    const LVN = { soul: '灵魂', user: '关于她', project: '项目', rules: '准则', fact: '事实', lesson: '教训', topic: '话题' };
    const LVC = { soul: '#7ee0b0', user: '#7ee0b0', project: '#ffd166', rules: '#ffd166', fact: '#8fcaff', lesson: '#8fcaff', topic: '#c792ea' };

    /* ---------------- 数据 ---------------- */
    function useMemory() {
      const [st, setSt] = useState({ loading: true, items: [], stats: null, err: null });
      useEffect(() => {
        let alive = true;
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 9000);
        fetch(API, { cache: 'no-store', signal: ac.signal })
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then((j) => { if (alive) setSt({ loading: false, items: j.items || [], stats: j.stats, err: null }); })
          .catch((e) => { if (alive) setSt({ loading: false, items: [], stats: null, err: String((e && e.message) || e) }); })
          .finally(() => clearTimeout(t));
        return () => { alive = false; ac.abort(); clearTimeout(t); };
      }, []);
      return st;
    }

    /* ---------------- 三维球面布局 ---------------- */
    function norm(v) {
      const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    }
    function fibDir(i, n) {
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    }

    const LAYER_ORDER = ['soul', 'user', 'rules', 'project', 'topic', 'fact', 'lesson'];

    function hexA(hex, a) {
      const s = String(hex || '#8fcaff').replace('#', '');
      const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    /** 球壳半径按我库里的真实条数分配：条数多的层占更大的球面，密度才不至于一边挤死一边空着。 */
    function layerRadii(byLv) {
      const cnt = {}, order = LAYER_ORDER;
      let tot = 0;
      order.forEach((lv) => { cnt[lv] = (byLv[lv] || []).length; tot += cnt[lv]; });
      tot = tot || 1;
      let acc = 0;
      const out = {};
      order.forEach((lv) => {
        acc += cnt[lv];
        out[lv] = Math.sqrt(acc / tot);
      });
      let prev = 0;
      order.forEach((lv) => { out[lv] = Math.max(out[lv], prev + 0.10); prev = out[lv]; });
      const mx = out[order[order.length - 1]] || 1;
      order.forEach((lv) => { out[lv] = 0.30 + 0.70 * (out[lv] / mx); });
      return out;
    }

    /** 球面力导向：同层内，共享关键词的记忆互相靠近，其余互相推开。
     *  这样簇的形状由真实关联决定，不再是我画的均匀圆点阵。 */
    function relaxLayer(nodes, idxs, edges, R) {
      const n = idxs.length;
      if (n < 3) return;
      const pos = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        const nd = nodes[idxs[k]];
        const l = Math.sqrt(nd.x * nd.x + nd.y * nd.y + nd.z * nd.z) || 1;
        pos[k * 3] = nd.x / l; pos[k * 3 + 1] = nd.y / l; pos[k * 3 + 2] = nd.z / l;
      }
      const local = new Map();
      for (let k = 0; k < n; k++) local.set(idxs[k], k);
      const adj = Array.from({ length: n }, () => []);
      for (const [a, b] of edges) {
        const ka = local.get(a), kb = local.get(b);
        if (ka === undefined || kb === undefined) continue;
        adj[ka].push(kb); adj[kb].push(ka);
      }
      const G = 20;
      const disp = new Float32Array(n * 3);
      for (let it = 0; it < 22; it++) {
        disp.fill(0);
        const grid = new Map();
        for (let k = 0; k < n; k++) {
          const x = (pos[k * 3] * 0.5 + 0.5) * G | 0;
          const y = (pos[k * 3 + 1] * 0.5 + 0.5) * G | 0;
          const z = (pos[k * 3 + 2] * 0.5 + 0.5) * G | 0;
          const key = x + ',' + y + ',' + z;
          let arr = grid.get(key);
          if (!arr) { arr = []; grid.set(key, arr); }
          arr.push(k);
        }
        for (let k = 0; k < n; k++) {
          const px = pos[k * 3], py = pos[k * 3 + 1], pz = pos[k * 3 + 2];
          const cx = (px * 0.5 + 0.5) * G | 0, cy = (py * 0.5 + 0.5) * G | 0, cz = (pz * 0.5 + 0.5) * G | 0;
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            const arr = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
            if (!arr) continue;
            for (let ai = 0; ai < arr.length; ai++) {
              const j = arr[ai];
              if (j === k) continue;
              const ex = px - pos[j * 3], ey = py - pos[j * 3 + 1], ez = pz - pos[j * 3 + 2];
              const d2 = ex * ex + ey * ey + ez * ez + 1e-4;
              const f = 0.0016 / d2;
              disp[k * 3] += ex * f; disp[k * 3 + 1] += ey * f; disp[k * 3 + 2] += ez * f;
            }
          }
        }
        for (let k = 0; k < n; k++) {
          for (let ai = 0; ai < adj[k].length; ai++) {
            const j = adj[k][ai];
            disp[k * 3] += (pos[j * 3] - pos[k * 3]) * 0.035;
            disp[k * 3 + 1] += (pos[j * 3 + 1] - pos[k * 3 + 1]) * 0.035;
            disp[k * 3 + 2] += (pos[j * 3 + 2] - pos[k * 3 + 2]) * 0.035;
          }
        }
        for (let k = 0; k < n; k++) {
          pos[k * 3] += disp[k * 3];
          pos[k * 3 + 1] += disp[k * 3 + 1];
          pos[k * 3 + 2] += disp[k * 3 + 2];
          const l = Math.sqrt(pos[k * 3] * pos[k * 3] + pos[k * 3 + 1] * pos[k * 3 + 1] + pos[k * 3 + 2] * pos[k * 3 + 2]) || 1;
          pos[k * 3] /= l; pos[k * 3 + 1] /= l; pos[k * 3 + 2] /= l;
        }
      }
      // 写回：保持原来的层半径不变，只改方向
      for (let k = 0; k < n; k++) {
        const nd = nodes[idxs[k]];
        const r0 = Math.sqrt(nd.x * nd.x + nd.y * nd.y + nd.z * nd.z);
        nd.x = pos[k * 3] * r0;
        nd.y = pos[k * 3 + 1] * r0;
        nd.z = pos[k * 3 + 2] * r0;
      }
    }

    function buildBall(items, R) {
      const byLv = {};
      for (const it of items) {
        const lv = LAYER_ORDER.indexOf(it.lv) >= 0 ? it.lv : 'fact';
        (byLv[lv] = byLv[lv] || []).push(it);
      }
      const RAD = layerRadii(byLv);
      const nodes = [], shells = [];
      const now = Date.now();
      LAYER_ORDER.forEach((lv) => {
        const list = byLv[lv] || [];
        const rr = R * (RAD[lv] || 0.6);
        const n = list.length;
        // 这一层球面上按项目分片：同项目的记忆聚成一块，能看出「谁和谁在一起」
        const byP = new Map();
        for (const it of list) {
          const k = it.pj || ('· ' + it.lv);
          if (!byP.has(k)) byP.set(k, []);
          byP.get(k).push(it);
        }
        const groups = [...byP.entries()].sort((a, b) => b[1].length - a[1].length);
        groups.forEach(([pk, glist], gi) => {
          const dir = fibDir(gi + 0.5, Math.max(1, groups.length));
          const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
          const u = norm([
            up[1] * dir[2] - up[2] * dir[1],
            up[2] * dir[0] - up[0] * dir[2],
            up[0] * dir[1] - up[1] * dir[0],
          ]);
          const v = [
            dir[1] * u[2] - dir[2] * u[1],
            dir[2] * u[0] - dir[0] * u[2],
            dir[0] * u[1] - dir[1] * u[0],
          ];
          const cap = Math.min(1.02, Math.sqrt(glist.length / Math.max(1, n)) * 1.45 + 0.12);
          glist.forEach((it, i) => {
            const t = Math.sqrt((i + 0.5) / glist.length) * cap;
            const phi = i * 2.399963229728653;
            const ct = Math.cos(t), st = Math.sin(t);
            const cp = Math.cos(phi), sp = Math.sin(phi);
            const x = dir[0] * ct + (u[0] * cp + v[0] * sp) * st;
            const y = dir[1] * ct + (u[1] * cp + v[1] * sp) * st;
            const z = dir[2] * ct + (u[2] * cp + v[2] * sp) * st;
            const fresh = it.up ? Math.max(0, 1 - (now - it.up) / (86400000 * 40)) : 0.2;
            // 遗忘：多久没被取用过。越久越暗、越灰，直到不再呼吸
            const age = it.acc ? (now - it.acc) / 86400000 : 400;
            const useFresh = Math.max(0, 1 - age / 120);
            const frozen = it.st === 'active' && age > 45 && fresh < 0.25;
            nodes.push({
              it, x: x * rr, y: y * rr, z: z * rr, pk,
              r: 1.8 + Math.min(4.2, (it.im || 1) * 0.66),
              ph: (i * 2.399) % 6.283,
              age,
              frozen,
              a0: it.st !== 'active' ? 0.10 : (0.115 + fresh * 0.32 + useFresh * 0.32),
              hot: it.st === 'active' && !frozen && fresh > 0.55,
            });
          });
        });
        shells.push({ lv, r: rr, n, color: LVC[lv] || '#8fcaff', groups: groups.length });
      });

      // 边：共享关键词
      const byKw = new Map();
      nodes.forEach((n, i) => {
        for (const k of (n.it.kw || [])) {
          if (!byKw.has(k)) byKw.set(k, []);
          byKw.get(k).push(i);
        }
      });
      const edges = [];
      const seen = new Set();
      for (const [, idx] of byKw) {
        if (idx.length < 2 || idx.length > 24) continue;
        const cap = Math.min(idx.length - 1, 4);
        for (let i = 0; i < cap; i++) {
          const a = idx[i], b = idx[i + 1];
          const key = Math.min(a, b) + ':' + Math.max(a, b);
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push([a, b]);
        }
      }
      // 球面力导向：让相关的记忆自己抱团（跨层边忽略，保持层的结构）
      const lvIdx = {};
      nodes.forEach((nd, i) => { (lvIdx[nd.it.lv] = lvIdx[nd.it.lv] || []).push(i); });
      for (const lv in lvIdx) {
        try { relaxLayer(nodes, lvIdx[lv], edges, R); } catch (e) { /* 布局失败就用原坐标 */ }
      }

      return { nodes, edges, shells };
    }

    function makeDot(rgb, size) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0, 'rgba(255,252,240,1)');
      grd.addColorStop(0.24, rgb);
      grd.addColorStop(0.55, rgb.replace('1)', '0.32)'));
      grd.addColorStop(1, rgb.replace('1)', '0)'));
      g.fillStyle = grd;
      g.fillRect(0, 0, size, size);
      return c;
    }

    /* ---------------- 三维星图 ---------------- */
    function StarCanvas({ items, width, height, matched, selId, onPick, hidden, focus, onPickLayer }) {
      const cvRef = useRef(null);
      const layRef = useRef(null);
      const hoverRef = useRef(null);
      const rotRef = useRef({ rx: -0.18, ry: 0.4, zoom: 1, auto: true });
      const liveRef = useRef({ matched: null, selId: null });
      liveRef.current = { matched, selId, hidden, focus };

      useEffect(() => {
        const cv = cvRef.current;
        if (!cv || !items.length) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(width * dpr);
        cv.height = Math.round(height * dpr);
        const ctx = cv.getContext('2d');
        if (!ctx) return;

        const R = Math.min(width, height) * 0.40;
        const lay = buildBall(items, R);
        layRef.current = lay;

        const SPR = 128;
        const dotWarm = makeDot('rgba(255,220,150,1)', SPR);
        const dotHot = makeDot('rgba(255,242,205,1)', SPR);
        const dotDim = makeDot('rgba(150,140,130,1)', SPR);
        // 每层一枚低饱和度的色，不刺眼但一眼能分出层次
        const LVS = {
          soul: '#9fe8c8', user: '#9fd8f0', rules: '#f0d0a0', project: '#c8b8f0',
          topic: '#a8bdF0', fact: '#a8e8c0', lesson: '#f0b8d0',
        };
        const layerDots = {};
        for (const sh of lay.shells) layerDots[sh.lv] = makeDot(hexA(LVS[sh.lv] || sh.color, 1), SPR);

        // 背景
        const bgc = document.createElement('canvas');
        bgc.width = cv.width; bgc.height = cv.height;
        const bg = bgc.getContext('2d');
        if (bg) {
          bg.setTransform(dpr, 0, 0, dpr, 0, 0);
          const g0 = bg.createRadialGradient(width * 0.5, height * 0.46, 8, width * 0.5, height * 0.5, Math.max(width, height) * 0.82);
          g0.addColorStop(0, '#0c0618');
          g0.addColorStop(0.42, '#05020e');
          g0.addColorStop(0.75, '#020106');
          g0.addColorStop(1, '#000001');
          bg.fillStyle = g0;
          bg.fillRect(0, 0, width, height);
          // 星云：几团不同色温的雾，撑起背景的层次
          const nebula = [
            [0.30, 0.32, 0.46, '126,84,222', 0.021],
            [0.74, 0.28, 0.40, '104,86,214', 0.015],
            [0.58, 0.72, 0.50, '154,78,186', 0.011],
            [0.22, 0.78, 0.36, '92,92,208', 0.013],
            [0.52, 0.48, 0.62, '150,116,238', 0.012],
          ];
          for (const [fx, fy, fr, rgb, a] of nebula) {
            const nx = fx * width, ny = fy * height, nr = fr * Math.min(width, height);
            const g1 = bg.createRadialGradient(nx, ny, 0, nx, ny, nr);
            g1.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
            g1.addColorStop(0.55, 'rgba(' + rgb + ',' + (a * 0.4).toFixed(3) + ')');
            g1.addColorStop(1, 'rgba(' + rgb + ',0)');
            bg.fillStyle = g1;
            bg.fillRect(0, 0, width, height);
          }
          // 星尘：大小、色温、亮度都不一样的细点
          for (let i = 0; i < 1600; i++) {
            const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * width;
            const y = (Math.cos(i * 47.3) * 0.5 + 0.5) * height;
            const warm = i % 11 === 0;
            bg.globalAlpha = 0.005 + (i % 10) * 0.0032;
            bg.fillStyle = warm ? '#ffe9c8' : (i % 7 === 0 ? '#bfd4ff' : '#e6ecff');
            const s = i % 17 === 0 ? 1.9 : (i % 13 === 0 ? 1.4 : (i % 5 === 0 ? 1.05 : 0.75));
            bg.fillRect(x, y, s, s);
          }
          // 极远处的几颗亮星（带一点点光晕）
          for (let i = 0; i < 18; i++) {
            const x = (Math.sin(i * 33.3 + 1.7) * 0.5 + 0.5) * width;
            const y = (Math.cos(i * 57.1 + 0.4) * 0.5 + 0.5) * height;
            const rr = 1.4 + (i % 4) * 0.7;
            const g2 = bg.createRadialGradient(x, y, 0, x, y, rr * 4);
            g2.addColorStop(0, 'rgba(238,240,255,0.42)');
            g2.addColorStop(0.22, 'rgba(214,224,255,0.11)');
            g2.addColorStop(1, 'rgba(190,205,255,0)');
            bg.fillStyle = g2;
            bg.beginPath(); bg.arc(x, y, rr * 4, 0, 7); bg.fill();
          }
          bg.globalAlpha = 1;
        }

        // 放电只从「最近被取用过的记忆」出发——亮一下 = 这条最近被想起过
        const adjIdx = lay.nodes.map(() => []);
        for (const [a, b] of lay.edges) { adjIdx[a].push(b); adjIdx[b].push(a); }
        const freshIdx = [];
        for (let i = 0; i < lay.nodes.length; i++) {
          if (lay.nodes[i].it.st === 'active' && lay.nodes[i].age < 5) freshIdx.push(i);
        }

        const idx = new Array(lay.nodes.length);
        for (let i = 0; i < idx.length; i++) idx[i] = i;
        const proj = new Float32Array(lay.nodes.length * 4);
        const pulses = [];
        // 晕染用 1/4 分辨率小画布渲染再放大：又便宜、放大本身又自带「弥漫」质感
        const WSC = 4;
        const wcv = document.createElement('canvas');
        wcv.width = Math.max(80, Math.round(width / WSC));
        wcv.height = Math.max(80, Math.round(height / WSC));
        const wctx = wcv.getContext('2d');

        let raf = 0, alive = true;
        const t0 = performance.now();
        const CX = width / 2, CY = height / 2;
        let sBaseCur = 1;

        function draw(ts) {
          if (!alive) return;
          const el = ts - t0;
          const rot = rotRef.current;
          const live = liveRef.current;
          const M = live.matched, S = live.selId, HID = live.hidden || {}, F = live.focus || null;
          // 分层体现在「光点」上：选中那层全亮，其他层的点还在、只是暗下去；球只是容器
          const vis = (it) => !HID[it.lv];
          const dimOf = (it) => {
            if (!F) return 1;
            return it.lv === F ? 2.8 : 0.08;
          };

          if (rot.auto && !rot.drag) rot.ry += 0.000045 * 16;

          // 背景整片缓缓漂移，像雾在流动
          const bgDx = Math.sin(el / 26000) * 26;
          const bgDy = Math.cos(el / 31000) * 20;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.drawImage(bgc, bgDx - 30, bgDy - 30, width + 60, height + 60);

          // 深空视差：比背景漂得更快的一层极暗星光，让「深」有纵深
          ctx.fillStyle = '#dfe6ff';
          for (let si = 0; si < 90; si++) {
            const sx = ((Math.sin(si * 127.1) * 0.5 + 0.5) * width + bgDx * 0.42 + width) % width;
            const sy = ((Math.cos(si * 311.7) * 0.5 + 0.5) * height + bgDy * 0.42 + height) % height;
            ctx.globalAlpha = 0.045 + (si % 6) * 0.018;
            const ss = si % 9 === 0 ? 1.7 : 1;
            ctx.fillRect(sx, sy, ss, ss);
          }
          ctx.globalAlpha = 1;

          // 动态晕染：6 层缓慢游动的彩色柔光 + 球心「璀璨」呼吸光，整层画在 1/4 分辨率小画布上再放大。
          // 它铺在星点【下面】——晕染只染气氛，不盖光点，光点才不会被洗糊。
          if (wctx) {
            const ww = wcv.width, wh = wcv.height, wcx = ww / 2, wcy = wh / 2;
            const focK = F ? 0.55 : 1;   // 聚焦某层时，整体晕染压暗，凸显该层
            wctx.setTransform(1, 0, 0, 1, 0, 0);
            wctx.globalCompositeOperation = 'source-over';
            wctx.fillStyle = 'rgba(2,1,6,1)';
            wctx.fillRect(0, 0, ww, wh);
            wctx.globalCompositeOperation = 'lighter';
            for (let bi = 0; bi < 6; bi++) {
              const sp = 0.000095 + bi * 0.00003;
              const bx = wcx + Math.sin(el * sp + bi * 1.7) * ww * (0.30 + (bi % 3) * 0.07);
              const by = wcy + Math.cos(el * sp * 0.8 + bi * 2.3) * wh * (0.28 + (bi % 2) * 0.08);
              const br = Math.min(ww, wh) * (0.36 + bi * 0.10) * (1 + Math.sin(el / 9000 + bi) * 0.15);
              const hue = (bi * 44 + el * 0.0035) % 360;
              const g3 = wctx.createRadialGradient(bx, by, 0, bx, by, br);
              g3.addColorStop(0, 'hsla(' + hue.toFixed(0) + ',80%,60%,0.135)');
              g3.addColorStop(0.5, 'hsla(' + ((hue + 26) % 360).toFixed(0) + ',78%,54%,0.055)');
              g3.addColorStop(1, 'hsla(' + ((hue + 52) % 360).toFixed(0) + ',78%,48%,0)');
              wctx.fillStyle = g3;
              wctx.fillRect(0, 0, ww, wh);
            }
            // 动态光晕：一层随呼吸胀缩的大光晕，把整个球包住
            const haloB = 0.5 + 0.5 * Math.sin(el / 7400);
            const hg = wctx.createRadialGradient(wcx, wcy, Math.min(ww, wh) * 0.08, wcx, wcy, Math.min(ww, wh) * (0.74 + haloB * 0.18));
            hg.addColorStop(0, 'hsla(38,88%,66%,' + ((0.013 + haloB * 0.012) * focK).toFixed(3) + ')');
            hg.addColorStop(0.55, 'hsla(33,86%,58%,' + ((0.006 + haloB * 0.005) * focK).toFixed(3) + ')');
            hg.addColorStop(1, 'hsla(28,84%,52%,0)');
            wctx.fillStyle = hg;
            wctx.fillRect(0, 0, ww, wh);

            // 球心的「璀璨」：暖白光团随呼吸胀缩，隔着暗环境往外洇
            const bloom = 0.5 + 0.5 * Math.sin(el / 5200);
            const cg = wctx.createRadialGradient(wcx, wcy, 0, wcx, wcy, Math.min(ww, wh) * (0.34 + bloom * 0.12));
            cg.addColorStop(0, 'hsla(' + (46 + bloom * 12).toFixed(0) + ',95%,74%,' + ((0.055 + bloom * 0.040) * focK).toFixed(3) + ')');
            cg.addColorStop(0.45, 'hsla(' + (312 + bloom * 18).toFixed(0) + ',74%,56%,' + (0.018 * focK).toFixed(3) + ')');
            cg.addColorStop(1, 'hsla(262,72%,50%,0)');
            wctx.fillStyle = cg;
            wctx.fillRect(0, 0, ww, wh);
            wctx.globalCompositeOperation = 'source-over';

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.drawImage(wcv, 0, 0, width, height);
            ctx.restore();
          }

          const cy = Math.cos(rot.ry), sy = Math.sin(rot.ry);
          const cxr = Math.cos(rot.rx), sxr = Math.sin(rot.rx);
          const zoom = rot.zoom * (1 + Math.sin(el / 21000) * 0.012);
          const camD = R * 3.1;
          const focal = R * 2.0 * zoom;

          // 投影
          for (let i = 0; i < idx.length; i++) {
            const nd = lay.nodes[i];
            const x1 = nd.x * cy - nd.z * sy;
            const z1 = nd.x * sy + nd.z * cy;
            const y1 = nd.y * cxr - z1 * sxr;
            const z2 = nd.y * sxr + z1 * cxr;
            const s = focal / (camD + z2);
            // 漂移也算进投影坐标：这样「画在哪」和「点哪命中」是同一个位置
            proj[i * 4] = CX + x1 * s + Math.sin(el / 2600 + nd.ph) * 2.9;
            proj[i * 4 + 1] = CY + y1 * s + Math.cos(el / 3100 + nd.ph * 1.7) * 2.4;
            proj[i * 4 + 2] = z2;
            proj[i * 4 + 3] = s;
          }
          // 远的先画
          idx.sort((a, b) => proj[b * 4 + 2] - proj[a * 4 + 2]);

          // 不再画外层光晕——它半径比最外圈球壳还大，看着像外面多套了一个空球

          // 连线
          ctx.lineWidth = 0.32;
          ctx.strokeStyle = 'rgba(228,198,146,0.075)';
          ctx.beginPath();
          for (let e = 0; e < lay.edges.length; e++) {
            const a = lay.edges[e][0], b = lay.edges[e][1];
            if (!vis(lay.nodes[a].it) || !vis(lay.nodes[b].it)) continue;
            ctx.moveTo(proj[a * 4], proj[a * 4 + 1]);
            ctx.lineTo(proj[b * 4], proj[b * 4 + 1]);
          }
          ctx.stroke();

          // 星点
          ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < idx.length; k++) {
            const i = idx[k];
            const nd = lay.nodes[i];
            if (!vis(nd.it)) continue;
            const z = proj[i * 4 + 2];
            const depth = Math.max(0.16, Math.min(1, (R - z) / (R * 2) + 0.62));
            let a = nd.a0 * depth * dimOf(nd.it);
            if (nd.it.st === 'active' && !nd.frozen) a *= 0.52 + 0.48 * Math.sin(el / 1300 + nd.ph);
            if (M && M.has(nd.it.id)) a = Math.min(1, a + 0.4);
            const isFoc = F && nd.it.lv === F;
            // 光点各自轻轻漂，像在水里浮——每颗的相位不同，不成片同步
            const isHov = hoverRef.current && hoverRef.current.it.id === nd.it.id;
            // 实心圆：比原来大一圈，好瞄准；悬停时再放大
            const frozenK = nd.frozen ? 0.6 : 1;
            const base = Math.max(1.3, nd.r * 1.0 * (0.78 + depth * 0.45) * (isFoc ? 1.65 : 1) * frozenK);
            const rr = base * (isHov ? 1.9 : 1);
            const head = nd.frozen
              ? 'rgba(118,112,104,'
              : ((F && !isFoc) ? 'rgba(132,126,118,' : 'rgba(255,228,164,');
            const al = Math.min(1, a) * (nd.frozen ? 0.72 : 1);
            const px2 = proj[i * 4], py2 = proj[i * 4 + 1];
            // 一颗光：预渲染的径向渐变缩放到目标尺寸——渐变到 0，没有边界
            // 光晕铺得更开（10 倍半径），中心再压一颗硬边高光核：晕归晕，核是实的，看起来才不糊
            const sz2 = Math.max(6, rr * 10);
            ctx.globalAlpha = al * (isFoc ? 0.88 : 0.66);
            ctx.drawImage(nd.frozen ? dotDim : ((F && !isFoc) ? dotDim : dotWarm), px2 - sz2 / 2, py2 - sz2 / 2, sz2, sz2);
            ctx.globalAlpha = Math.min(1, al * (isFoc ? 1.3 : 1.0));
            ctx.fillStyle = nd.frozen
              ? 'rgba(176,170,162,1)'
              : ((F && !isFoc) ? 'rgba(166,160,152,1)' : 'rgba(255,251,235,1)');
            ctx.beginPath(); ctx.arc(px2, py2, rr * 0.7, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;

          // 放电
          if (freshIdx.length && pulses.length < 12 && Math.random() < 0.22) {
            const src = freshIdx[(Math.random() * freshIdx.length) | 0];
            const nb = adjIdx[src];
            if (nb && nb.length) {
              pulses.push({ a: src, b: nb[(Math.random() * nb.length) | 0], t: 0, sp: 0.014 + Math.random() * 0.022 });
            }
          }
          for (let i = pulses.length - 1; i >= 0; i--) {
            const p = pulses[i];
            p.t += p.sp;
            if (p.t >= 1) { pulses.splice(i, 1); continue; }
            const ax = proj[p.a * 4], ay = proj[p.a * 4 + 1];
            const bx = proj[p.b * 4], by = proj[p.b * 4 + 1];
            const x = ax + (bx - ax) * p.t, y = ay + (by - ay) * p.t;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
            g.addColorStop(0, 'rgba(255,250,225,0.9)');
            g.addColorStop(1, 'rgba(255,220,140,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';

          // 选中/悬停某条记忆时，把它跟别人的连线单独拎出来——这才是「记忆之间的联系」
          // 只在「选中（点击）」时亮出关联连线；鼠标悬停不再画线
          const focusId = (S || null);
          if (focusId) {
            const near = [];
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255,230,170,0.55)';
            ctx.beginPath();
            for (let e = 0; e < lay.edges.length; e++) {
              const a = lay.edges[e][0], b = lay.edges[e][1];
              const A = lay.nodes[a], B = lay.nodes[b];
              if (!A || !B) continue;
              if (A.it.id === focusId || B.it.id === focusId) {
                ctx.moveTo(proj[a * 4], proj[a * 4 + 1]);
                ctx.lineTo(proj[b * 4], proj[b * 4 + 1]);
                near.push(A.it.id === focusId ? b : a);
              }
            }
            ctx.stroke();
            // 关联到的那几颗也点亮一下
            ctx.fillStyle = 'rgba(255,236,180,0.9)';
            for (let k = 0; k < near.length && k < 80; k++) {
              const nd = lay.nodes[near[k]];
              const sz = Math.max(1.6, nd.r * 0.9);
              ctx.beginPath();
              ctx.arc(proj[near[k] * 4], proj[near[k] * 4 + 1], sz, 0, 7);
              ctx.fill();
            }
          }

          // 选中
          if (S) {
            for (let i = 0; i < lay.nodes.length; i++) {
              if (lay.nodes[i].it.id !== S) continue;
              const pr = 1 + Math.sin(el / 260) * 0.12;
              ctx.beginPath();
              ctx.arc(proj[i * 4], proj[i * 4 + 1], (lay.nodes[i].r * 1.6 + 7) * pr, 0, 7);
              ctx.strokeStyle = 'rgba(255,235,180,0.92)';
              ctx.lineWidth = 1.3;
              ctx.stroke();
              break;
            }
          }
          const hv = hoverRef.current;
          if (hv) {
            ctx.beginPath();
            ctx.arc(hv.x, hv.y, hv.r + 5, 0, 7);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // 七层球壳：一层一圈，从里到外就是记忆的分层
          const sBase = focal / camD;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          // 七层球壳：画的是「球面」不是「环」——洋葱式一层套一层
          const projPoint = (x, y, z) => {
            const x1 = x * cy - z * sy;
            const z1 = x * sy + z * cy;
            const y1 = y * cxr - z1 * sxr;
            const z2 = y * sxr + z1 * cxr;
            const s = focal / (camD + z2);
            return { x: CX + x1 * s, y: CY + y1 * s, z: z2 };
          };
          const sBaseNow = focal / camD;
          sBaseCur = sBaseNow;
          const maxShell = lay.shells.reduce((m, s) => Math.max(m, s.n), 1);
          for (const sh of lay.shells) {
            if (HID[sh.lv]) continue;
            const isFoc = F === sh.lv;
            const dim = F ? (isFoc ? 1.15 : 0.16) : 1;
            const rr = sh.r * sBaseNow;
            // 只画环线，不填球面——填了会多出一层「玻璃球」的错觉
            const shellA = (0.050 + 0.135 * (sh.n / maxShell)) * dim;
            ctx.beginPath(); ctx.arc(CX, CY, rr, 0, 7);
            ctx.strokeStyle = isFoc
              ? 'rgba(255,243,214,0.88)'
              : 'rgba(230,216,188,' + shellA.toFixed(3) + ')';
            ctx.lineWidth = isFoc ? 2.5 : 1.1;
            ctx.stroke();
            // 两圈纬线，给球一点体积感
            for (let wi = 1; wi <= 2; wi++) {
              const ph = (wi / 3) * Math.PI;
              const yr = Math.cos(ph) * rr;
              const wr = Math.sin(ph) * rr;
              ctx.beginPath();
              ctx.ellipse(CX, CY + yr, wr, Math.max(1.2, wr * 0.24), 0, 0, 7);
              ctx.strokeStyle = 'rgba(226,214,190,' + (0.025 * dim).toFixed(3) + ')';
              ctx.lineWidth = 0.7;
              ctx.stroke();
            }
          }
          ctx.textAlign = 'center';

          // 暗角：四周压暗，注意力留在球上
          // 暗角：收得更靠里，并且缓慢“呼吸”——黑暗一阵阵压过来又退开，中间的星图才显得亮
          const vgPulse = 0.88 + 0.06 * Math.sin(el / 8200);
          const vg = ctx.createRadialGradient(CX, CY, Math.min(width, height) * 0.16, CX, CY, Math.max(width, height) * 0.66);
          vg.addColorStop(0, 'rgba(4,1,10,0)');
          vg.addColorStop(0.48, 'rgba(3,1,8,' + (vgPulse * 0.56).toFixed(3) + ')');
          vg.addColorStop(1, 'rgba(1,0,4,' + vgPulse.toFixed(3) + ')');
          ctx.fillStyle = vg;
          ctx.fillRect(0, 0, width, height);

          if (hv) {
            const lvName = LVN[hv.it.lv] || hv.it.lv;
            const line1 = (hv.it.tx || '').slice(0, 46);
            const line2 = lvName + ' · 重要度 ' + (hv.it.im || 1) + (hv.it.pj ? ' · ' + hv.it.pj : '') + ' · ' + fmtDate(hv.it.t);
            ctx.font = '12px "Microsoft YaHei",system-ui,sans-serif';
            const w1 = ctx.measureText(line1).width;
            ctx.font = '10.5px "Microsoft YaHei",system-ui,sans-serif';
            const w2 = ctx.measureText(line2).width;
            const tw = Math.min(width - 20, Math.max(w1, w2) + 26);
            const bh = 46;
            const bx = Math.max(8, (width - tw) / 2);
            const by = height - bh - 14;
            ctx.fillStyle = 'rgba(10,6,18,0.93)';
            ctx.fillRect(bx, by, tw, bh);
            ctx.strokeStyle = 'rgba(212,178,120,0.32)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, tw, bh);
            ctx.fillStyle = 'rgba(255,228,164,0.8)';
            ctx.fillRect(bx, by, 3, bh);
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.font = '12px "Microsoft YaHei",system-ui,sans-serif';
            ctx.fillStyle = 'rgba(242,234,216,0.95)';
            ctx.fillText(line1, bx + 13, by + 16);
            ctx.font = '10.5px "Microsoft YaHei",system-ui,sans-serif';
            ctx.fillStyle = 'rgba(214,196,160,0.62)';
            ctx.fillText(line2, bx + 13, by + 33);
          }
          raf = requestAnimationFrame(draw);
        }
        raf = requestAnimationFrame(draw);

        function hit(sx, sy) {
          let best = -1, bd = 30 * 30;
          const HID = liveRef.current.hidden || {};
          for (let i = 0; i < lay.nodes.length; i++) {
            if (HID[lay.nodes[i].it.lv]) continue;
            const dx = proj[i * 4] - sx, dy = proj[i * 4 + 1] - sy;
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
          }
          return best;
        }
        let down = null, moved = false;
        function onDown(e) {
          if (e.button === 2) e.preventDefault();
          down = { x: e.clientX, y: e.clientY, rx: rotRef.current.rx, ry: rotRef.current.ry };
          moved = false;
          rotRef.current.drag = true;
        }
        function onMove(e) {
          const r = cv.getBoundingClientRect();
          const sx = e.clientX - r.left, sy = e.clientY - r.top;
          if (down) {
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            if (moved) {
              rotRef.current.ry = down.ry + dx * 0.0075;
              rotRef.current.rx = Math.max(-1.45, Math.min(1.45, down.rx + dy * 0.0075));
            }
          }
          const ni = down ? -1 : hit(sx, sy);
          hoverRef.current = ni >= 0 ? { x: proj[ni * 4], y: proj[ni * 4 + 1], r: lay.nodes[ni].r, it: lay.nodes[ni].it, sx, sy } : null;
          cv.style.cursor = down ? 'grabbing' : (ni >= 0 ? 'pointer' : 'grab');
        }
        function onLeave() { hoverRef.current = null; }
        function onUp() { down = null; rotRef.current.drag = false; }
        function hitShell(sx, sy) {
          const d = Math.sqrt((sx - CX) * (sx - CX) + (sy - CY) * (sy - CY));
          let best = null, bd = 28;
          for (const sh of lay.shells) {
            const dd = Math.abs(d - sh.r * sBaseCur);
            if (dd < bd) { bd = dd; best = sh; }
          }
          return best;
        }
        function onClick(e) {
          if (moved) return;
          const r = cv.getBoundingClientRect();
          const sx = e.clientX - r.left, sy = e.clientY - r.top;
          const ni = hit(sx, sy);
          if (ni >= 0 && onPick) { onPick(lay.nodes[ni].it); return; }
          // 没点到光点，就按离中心多远判断点到了哪一层球壳
          const sh = hitShell(sx, sy);
          if (sh && onPickLayer) onPickLayer(sh.lv);
        }
        function onWheel(e) {
          e.preventDefault();
          const z = rotRef.current.zoom;
          rotRef.current.zoom = Math.min(2.6, Math.max(0.5, z * (e.deltaY > 0 ? 0.92 : 1.08)));
        }
        function onCtx(e) { e.preventDefault(); }
        cv.addEventListener('mousedown', onDown);
        cv.addEventListener('mousemove', onMove);
        cv.addEventListener('mouseleave', onLeave);
        cv.addEventListener('wheel', onWheel, { passive: false });
        cv.addEventListener('click', onClick);
        cv.addEventListener('contextmenu', onCtx);
        window.addEventListener('mouseup', onUp);
        return () => {
          alive = false;
          cancelAnimationFrame(raf);
          cv.removeEventListener('mousedown', onDown);
          cv.removeEventListener('mousemove', onMove);
          cv.removeEventListener('mouseleave', onLeave);
          cv.removeEventListener('wheel', onWheel);
          cv.removeEventListener('click', onClick);
          cv.removeEventListener('contextmenu', onCtx);
          window.removeEventListener('mouseup', onUp);
        };
      }, [items, width, height]);

      return h('canvas', { ref: cvRef, style: { width: width + 'px', height: height + 'px', display: 'block', borderRadius: '10px', cursor: 'grab' } });
    }

    /* ---------------- 详情 / 列表 ---------------- */
    function fmtDate(t) {
      if (!t) return '—';
      const d = new Date(t);
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function ago(t) {
      if (!t) return '从未';
      const s = (Date.now() - t) / 1000;
      if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' 分钟前';
      if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
      return Math.floor(s / 86400) + ' 天前';
    }

    function layerBtn(on) {
      return {
        border: '1px solid ' + (on ? 'rgba(255,238,204,0.62)' : 'rgba(212,178,120,0.20)'),
        background: on ? 'rgba(255,238,204,0.15)' : 'rgba(255,255,255,0.03)',
        color: on ? '#ffeecb' : 'rgba(226,196,142,0.62)',
        height: '21px', borderRadius: '6px', cursor: 'pointer',
        fontSize: '10.5px', padding: '0 9px', whiteSpace: 'nowrap',
      };
    }

    function Detail({ it, onKw, items, onPick }) {
      if (!it) return null;
      const rel = (items || []).filter((m) => m.id !== it.id && ((it.pj && m.pj === it.pj) || (it.kw || []).some((k) => (m.kw || []).indexOf(k) >= 0))).slice(0, 6);
      return h('div', null,
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' } },
          h('span', { style: { fontSize: '11px', color: LVC[it.lv] || '#8fcaff', border: '1px solid ' + (LVC[it.lv] || '#8fcaff') + '55', borderRadius: '99px', padding: '1px 8px' } }, LVN[it.lv] || it.lv),
          it.pj ? h('span', { style: { fontSize: '11px', color: 'rgba(200,220,255,0.55)' } }, it.pj) : null,
          h('span', { style: { fontSize: '11px', color: 'rgba(200,220,255,0.45)' } }, '重要度 ' + (it.im || 1)),
          it.st !== 'active' ? h('span', { style: { fontSize: '11px', color: 'rgba(255,170,170,0.8)' } }, it.st) : null
        ),
        h('div', {
          style: { fontSize: '13px', lineHeight: 1.85, color: '#dbe7f7', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(255,255,255,0.025)', borderRadius: '8px', padding: '10px 11px' },
        }, it.tx),
        h('div', { style: { marginTop: '8px', fontSize: '11px', color: 'rgba(180,205,235,0.5)', display: 'flex', gap: '12px', flexWrap: 'wrap' } },
          h('span', null, '写下 ' + fmtDate(it.t)),
          h('span', null, '取用 ' + (it.hit || 0) + ' 次'),
          h('span', null, '最近 ' + ago(it.acc))
        ),
        h('div', { style: { marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap' } },
          (it.kw || []).map((k) => h('span', {
            key: k, onClick: () => onKw && onKw(k),
            style: { fontSize: '10.5px', color: 'rgba(200,220,250,0.7)', border: '1px solid rgba(140,180,230,0.24)', borderRadius: '99px', padding: '1px 8px', cursor: 'pointer' },
          }, k))
        ),
        rel.length ? h('div', { style: { marginTop: '13px' } },
          h('div', { style: { fontSize: '11px', color: 'rgba(232,203,152,0.7)', marginBottom: '5px' } }, '关联记忆 ' + rel.length),
          rel.map((m) => h('div', {
            key: m.id, onClick: () => onPick && onPick(m),
            style: { cursor: 'pointer', padding: '4px 0', borderBottom: '1px dashed rgba(120,150,190,0.12)', fontSize: '11.5px', color: 'rgba(210,228,248,0.78)' },
          }, h('span', { style: { color: LVC[m.lv] || '#8fcaff', marginRight: '5px' } }, '·'),
             (m.tx || '').slice(0, 30) + ((m.tx || '').length > 30 ? '…' : '')))
        ) : null,
        h('div', { style: { marginTop: '10px' } },
          h('span', {
            title: '点击复制 ID',
            onClick: (ev) => { try { navigator.clipboard.writeText(it.id); ev.target.textContent = '已复制'; } catch (e) {} },
            style: { fontSize: '10px', color: 'rgba(160,185,215,0.42)', cursor: 'pointer', userSelect: 'all' },
          }, it.id)
        )
      );
    }

    function ListPane({ list, onPick, selId }) {
      if (!list.length) return h('div', { style: { padding: '18px 4px', fontSize: '12px', color: 'rgba(180,205,235,0.45)' } }, '没有匹配的记忆。');
      return h('div', null,
        list.map((it) => h('div', {
          key: it.id, onClick: () => onPick(it),
          style: { padding: '7px 8px', borderRadius: '7px', cursor: 'pointer', marginBottom: '2px', background: it.id === selId ? 'rgba(255,225,150,0.10)' : 'transparent', borderLeft: '2px solid ' + (LVC[it.lv] || '#8fcaff') },
        },
          h('div', { style: { fontSize: '12px', color: 'rgba(210,228,248,0.92)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } }, it.tx),
          h('div', { style: { fontSize: '10px', color: 'rgba(180,205,235,0.38)', marginTop: '2px' } },
            (LVN[it.lv] || it.lv) + (it.pj ? ' · ' + it.pj : '') + ' · ' + fmtDate(it.t))
        ))
      );
    }

    /* ---------------- 面板 ---------------- */
    function StarPanel() {
      const [open, setOpen] = useState(false);
      const [vp, setVp] = useState({
        w: (typeof window !== 'undefined' ? window.innerWidth : 1280),
        h: (typeof window !== 'undefined' ? window.innerHeight : 860),
      });
      const [q, setQ] = useState('');
      const [sel, setSel] = useState(null);
      const [hidden, setHidden] = useState({});
      const [focus, setFocus] = useState(null);
      const [nonce, setNonce] = useState(0);
      const [pos, setPos] = useState(() => { try { const s = localStorage.getItem('starmap-orb'); if (s) return JSON.parse(s); } catch (e) {} return { x: 12, y: null }; });
      useEffect(() => { try { localStorage.setItem('starmap-orb', JSON.stringify(pos)); } catch (e) {} }, [pos]);
      useEffect(() => {
        const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
      }, []);
      const { items, stats, err, loading } = useMemory();

      const W = Math.max(780, Math.min(vp.w - 72, 1720));
      const H = Math.max(480, Math.min(vp.h - 92, 1120));
      const SIDE = 332;
      const MAPW = W - SIDE - 26;
      const MAPH = H - 96;

      const matched = (() => {
        const s = new Set();
        const kw = q.trim().toLowerCase();
        if (!kw) return s;
        for (const it of items) {
          const hay = ((it.tx || '') + ' ' + (it.kw || []).join(' ') + ' ' + (it.pj || '')).toLowerCase();
          if (hay.indexOf(kw) >= 0 || (it.kw || []).some((k) => k.toLowerCase().indexOf(kw) >= 0)) s.add(it.id);
        }
        return s;
      })();

      const hitList = (() => {
        if (!q.trim()) return [];
        const arr = items.filter((it) => matched.has(it.id));
        arr.sort((a, b) => (b.up || b.t || 0) - (a.up || a.t || 0));
        return arr.slice(0, 60);
      })();

      const root = {
        position: 'fixed', left: Math.round((vp.w - W) / 2) + 'px',
        top: Math.round(Math.max(16, (vp.h - H) / 2 - 6)) + 'px',
        zIndex: 60, width: W + 'px',
        fontFamily: '"Microsoft YaHei",system-ui,sans-serif', pointerEvents: 'auto',
      };

      if (!open) {
        const sty = pos.y == null
          ? { position: 'fixed', left: pos.x + 'px', bottom: '14px', zIndex: 60, pointerEvents: 'auto' }
          : { position: 'fixed', left: pos.x + 'px', top: pos.y + 'px', zIndex: 60, pointerEvents: 'auto' };
        return h('div', {
          style: sty,
          onMouseDown: (e) => {
            e.preventDefault();
            const st = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y == null ? (window.innerHeight - 56) : pos.y, moved: false };
            const onMove = (ev) => {
              const dx = ev.clientX - st.sx, dy = ev.clientY - st.sy;
              if (Math.abs(dx) + Math.abs(dy) > 4) st.moved = true;
              if (st.moved) setPos({ x: Math.max(4, Math.min(window.innerWidth - 50, st.ox + dx)), y: Math.max(4, Math.min(window.innerHeight - 50, st.oy + dy)) });
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              if (!st.moved) setOpen(true);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          },
        },
          h('div', {
            title: '点一下打开记忆星图 · 按住可以拖到别处',
            style: {
              width: '42px', height: '42px', borderRadius: '21px', cursor: 'grab',
              border: '1px solid rgba(212,178,120,0.45)',
              background: 'radial-gradient(circle at 35% 30%, #2a1a48 0%, #140b24 70%)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.45), inset 0 0 12px rgba(255,210,130,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            },
          },
            h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' },
              h('circle', { cx: 12, cy: 12, r: 2.1, fill: '#ffe0a0' }),
              h('circle', { cx: 5, cy: 7, r: 1.3, fill: '#c9a26a' }),
              h('circle', { cx: 19, cy: 6.5, r: 1.1, fill: '#c9a26a' }),
              h('circle', { cx: 18, cy: 18.5, r: 1.4, fill: '#e8c07a' }),
              h('circle', { cx: 5.5, cy: 17, r: 1, fill: '#8a6a45' }),
              h('path', { d: 'M12 12L5 7M12 12L19 6.5M12 12L18 18.5M12 12L5.5 17', stroke: 'rgba(212,178,120,0.55)', strokeWidth: 0.8 })
            )
          )
        );
      }

      const sideContent = sel
        ? h(Detail, { it: sel, items, onPick: (m) => setSel(m), onKw: (k) => { setQ(k); setSel(null); } })
        : (q.trim()
          ? h(ListPane, { list: hitList, onPick: (it) => setSel(it), selId: sel && sel.id })
          : h('div', { style: { fontSize: '12px', color: 'rgba(180,205,235,0.5)', lineHeight: 2 } },
              h('div', { style: { color: 'rgba(232,203,152,0.75)', marginBottom: '6px' } }, '怎么看'),
              h('div', null, '· 左键或右键拖 → 转动这个球'),
              h('div', null, '· 滚轮 → 放大缩小'),
              h('div', null, '· 点一个金点 → 这里显示整条记忆'),
              h('div', null, '· 上面搜关键词 → 命中的点亮起来'),
              h('div', { style: { marginTop: '14px', color: 'rgba(232,203,152,0.7)' } }, '最近写下的'),
              h('div', { style: { marginTop: '4px' } },
                items.slice().sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 9).map((it) => h('div', {
                  key: it.id, onClick: () => setSel(it),
                  style: { cursor: 'pointer', padding: '5px 0', borderBottom: '1px dashed rgba(120,150,190,0.14)', fontSize: '11.5px', color: 'rgba(210,228,248,0.8)' },
                }, h('span', { style: { color: LVC[it.lv] || '#8fcaff', marginRight: '5px' } }, '·'),
                   (it.tx || '').slice(0, 34) + ((it.tx || '').length > 34 ? '…' : '')))
              )
            ));

      return h('div', { style: root },
        h('div', {
          style: {
            background: 'linear-gradient(180deg, rgba(24,14,42,0.985) 0%, rgba(11,6,20,0.985) 100%)',
            border: '1px solid rgba(212,178,120,0.28)', borderRadius: '14px',
            boxShadow: '0 18px 60px rgba(0,0,0,0.7)', overflow: 'hidden', height: H + 'px',
            display: 'flex', flexDirection: 'column',
          },
        },
          h('div', {
            style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 13px', borderBottom: '1px solid rgba(212,178,120,0.16)' },
          },
            h('span', { style: { fontSize: '13px', fontWeight: 600, color: '#f0dcaa', letterSpacing: '.5px', whiteSpace: 'nowrap' } }, '记忆星图'),
            h('span', { style: { fontSize: '11px', color: 'rgba(226,196,142,0.55)', whiteSpace: 'nowrap' } },
              loading ? '读取中…' : (err ? '读不到' : (items.length + ' 颗 · 活跃 ' + ((stats && stats.active) || 0)))),
            h('input', {
              value: q, onChange: (e) => setQ(e.target.value),
              placeholder: '搜一句话 / 关键词 —— 命中的点亮起来',
              style: { flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,178,120,0.24)', borderRadius: '8px', color: '#e8f0fb', fontSize: '12.5px', padding: '6px 10px', outline: 'none' },
            }),
            q.trim() ? h('span', { style: { fontSize: '11px', color: 'rgba(255,225,150,0.85)', whiteSpace: 'nowrap' } }, '命中 ' + matched.size) : null,
            h('button', {
              onClick: () => { setSel(null); setQ(''); }, title: '清掉搜索词和选中项，回到默认视图（不删任何记忆）',
              style: { border: '1px solid rgba(212,178,120,0.28)', background: 'rgba(255,255,255,0.04)', color: '#e2c48e', height: '26px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', padding: '0 8px' },
            }, '重置'),
            h('button', {
              onClick: () => setOpen(false), title: '收起',
              style: { border: '1px solid rgba(212,178,120,0.3)', background: 'rgba(255,255,255,0.04)', color: '#e2c48e', width: '26px', height: '26px', borderRadius: '7px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 },
            }, '–')
          ),
          h('div', { style: { flex: 1, display: 'flex', gap: '12px', padding: '10px 12px', minHeight: 0 } },
            h('div', { style: { flex: 1, minWidth: 0 } },
              err
                ? h('div', { style: { height: MAPH + 'px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'rgba(226,196,142,0.8)', fontSize: '12px', textAlign: 'center' } },
                    h('div', { style: { fontSize: '22px' } }, '☄'),
                    h('div', null, '读不到记忆库'),
                    h('div', { style: { color: 'rgba(226,196,142,0.5)', fontSize: '11px' } }, err),
                    h('div', { style: { color: 'rgba(226,196,142,0.45)', fontSize: '11px' } }, '本地服务 127.0.0.1:8801'))
                : h(StarCanvas, {
                    key: nonce, items, width: MAPW, height: MAPH, matched, selId: sel && sel.id, hidden, focus,
                    onPick: (it) => { setSel(it); setFocus(it.lv); },
                    onPickLayer: (lv) => { setFocus(focus === lv ? null : lv); },
                  })
            ),
            h('div', {
              style: { width: SIDE + 'px', flex: 'none', overflowY: 'auto', padding: '2px 4px 10px', borderLeft: '1px solid rgba(212,178,120,0.14)', paddingLeft: '12px' },
            }, sideContent)
          ),
          h('div', {
            style: { padding: '5px 13px 8px', borderTop: '1px solid rgba(212,178,120,0.12)', display: 'flex', gap: '10px', fontSize: '10.5px', color: 'rgba(226,196,142,0.45)', alignItems: 'center', flexWrap: 'wrap' },
          },
            h('span', { style: { whiteSpace: 'nowrap', color: 'rgba(226,196,142,0.45)' } }, '分层'),
            h('button', {
              onClick: () => setFocus(null),
              style: layerBtn(!focus),
            }, '全部'),
            Object.keys(LVN).map((lv) => h('button', {
              key: lv,
              onClick: () => setFocus(focus === lv ? null : lv),
              title: '只看' + LVN[lv],
              style: layerBtn(focus === lv),
            }, LVN[lv])),
            h('div', { style: { flex: 1 } }),
            h('button', {
              onClick: () => setNonce((n) => n + 1), title: '复位视角',
              style: { border: '1px solid rgba(212,178,120,0.24)', background: 'rgba(255,255,255,0.04)', color: '#e2c48e', height: '20px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', padding: '0 7px' },
            }, '复位视角'),
            stats ? h('span', null, '遗忘 ' + (stats.cold || 0) + ' · 归档 ' + (stats.dead || 0)) : null
          )
        )
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'memory-starmap', order: 90,
        }, StarPanel));
      },
    };
  },
});
