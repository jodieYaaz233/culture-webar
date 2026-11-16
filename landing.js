/* ==========================================================================
   龙马 · 落地页交互
   --------------------------------------------------------------------------
   只做落地页表现层：品牌入场与滚动状态、slogan 打字与滚动渐隐、
   3D 展示区（程序化环绕，可替换为 GLB）、模式入口的三条说明展开。
   不触碰 ble / three 主模块的任何逻辑与事件绑定。
   ========================================================================== */

(function () {
  'use strict';

  var startEl = document.getElementById('start');
  if (!startEl) return;

  var brandEl = document.getElementById('brandbar');
  var wordEl = document.getElementById('brandWord');
  var sloganEl = document.getElementById('sloganText');
  var sloganRule = document.querySelector('.slogan-rule');

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMQ.matches;

  /* ======================================================================
     逐字打字机
     ====================================================================== */
  function splitChars(el) {
    if (!el) return [];
    var text = el.textContent || '';
    el.textContent = '';
    var chars = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var s = document.createElement('i');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
      chars.push(s);
    }
    return chars;
  }

  function makeTyper(chars, step) {
    var raf = 0, startAt = 0, shown = 0, finished = true;

    function frame(now) {
      var want = Math.floor((now - startAt) / step) + 1;
      if (want > chars.length) want = chars.length;
      while (shown < want) {
        chars[shown].classList.add('on');
        shown++;
      }
      if (shown < chars.length) {
        raf = requestAnimationFrame(frame);
      } else {
        finished = true;
      }
    }

    return {
      run: function (delay) {
        cancelAnimationFrame(raf);
        for (var i = 0; i < chars.length; i++) chars[i].classList.remove('on');
        shown = 0;
        finished = false;
        startAt = performance.now() + (delay || 0);
        raf = requestAnimationFrame(frame);
      },
      finish: function () {
        cancelAnimationFrame(raf);
        for (var i = 0; i < chars.length; i++) chars[i].classList.add('on');
        shown = chars.length;
        finished = true;
      },
      isDone: function () { return finished; }
    };
  }

  var wordChars = [], sloganChars = [];

  // 品牌文字原样保留在 DOM 中；偏好减少动态时不做拆分
  if (wordEl && !reduce) wordChars = splitChars(wordEl);
  if (sloganEl && !reduce) sloganChars = splitChars(sloganEl);

  var wordTyper = makeTyper(wordChars, 150);
  var sloganTyper = makeTyper(sloganChars, 78);

  if (reduce) {
    if (sloganRule) sloganRule.classList.add('on');
  }

  /* ======================================================================
     品牌区：入场 → 滚动隐藏 → 回滚露 logo → 回顶重新逐字打出
     ====================================================================== */
  var HIDE_AT = 110;   // 超过此距离视为"离顶"
  var TOP_AT = 12;     // 低于此距离视为"回到顶部"
  var brandState = 'on';
  var lastY = 0;

  function setBrand(next) {
    if (brandState === next) return;
    brandState = next;
    startEl.dataset.nav = next;
    if (!brandEl) return;
    brandEl.dataset.state = next;
    brandEl.classList.toggle('is-off', next === 'off');
    brandEl.classList.toggle('is-logo', next === 'logo');
  }

  function typeWord(delay) {
    if (!brandEl) return;
    setBrand('on');
    if (reduce || !wordChars.length) { wordTyper.finish(); return; }
    wordTyper.run(delay || 0);
  }

  /* ======================================================================
     Slogan：滚动渐隐（最低 38%，永不全透明）
     ====================================================================== */
  var sloganRestTop = null;

  function measureSlogan() {
    if (!sloganEl) return;
    sloganRestTop = sloganEl.getBoundingClientRect().top + startEl.scrollTop;
  }

  function fadeSlogan() {
    if (!sloganEl) return;
    if (startEl.scrollTop <= 0) {
      sloganEl.style.opacity = '1';
      return;
    }
    if (sloganRestTop === null) measureSlogan();
    var rect = sloganEl.getBoundingClientRect();
    var span = Math.max(rect.height, 24);
    var p = (sloganRestTop - rect.top) / (sloganRestTop + span);
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    sloganEl.style.opacity = (1 - 0.62 * p).toFixed(3);
  }

  /* ======================================================================
     滚动主循环
     ====================================================================== */
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = startEl.scrollTop;
      var up = y < lastY - 1;

      if (y <= TOP_AT) {
        if (brandState !== 'on') typeWord(0);
      } else if (y >= HIDE_AT) {
        if (brandState !== 'off') setBrand('off');
      } else if (up && brandState === 'off') {
        setBrand('logo');       // 向上返回途中先只露 logo
      }

      lastY = y;
      fadeSlogan();
    });
  }

  startEl.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    measureSlogan();
    fadeSlogan();
  });

  /* ======================================================================
     入场（约 2 秒，只播一次）
     ====================================================================== */
  if (!reduce) {
    startEl.classList.add('intro');
    window.setTimeout(function () { startEl.classList.remove('intro'); }, 2200);
    typeWord(380);
    window.setTimeout(function () {
      sloganTyper.run(0);
      window.setTimeout(function () {
        if (sloganRule) sloganRule.classList.add('on');
      }, sloganChars.length * 78 + 120);
    }, 900);
  } else {
    typeWord(0);
  }

  // 首帧校正（字体加载后位置可能变化）
  window.setTimeout(function () {
    measureSlogan();
    fadeSlogan();
    lastY = startEl.scrollTop;
  }, 2400);

  /* ======================================================================
     模式入口：三条说明的展开
     ====================================================================== */
  var wraps = [].slice.call(document.querySelectorAll('.mode-wrap'));

  wraps.forEach(function (wrap) {
    var card = wrap.querySelector('.mode-card');
    var desc = wrap.querySelector('.mode-desc');
    var pops = wrap.querySelector('.pops');
    if (!card || !desc || !pops) return;

    // 说明文案直接取自原有 DOM，逐条对应，不做改写
    var items = (desc.textContent || '').split('·').map(function (s) {
      return s.trim();
    }).filter(Boolean);

    items.forEach(function (text, i) {
      var box = document.createElement('div');
      box.className = 'pop';
      box.style.setProperty('--i', String(i));
      box.textContent = text;
      pops.appendChild(box);
    });

    card.setAttribute('aria-expanded', 'false');
    card.setAttribute('aria-haspopup', 'true');

    function open() {
      if (wrap.classList.contains('is-open')) return;
      wrap.classList.add('is-open');
      card.setAttribute('aria-expanded', 'true');
    }
    function close() {
      if (!wrap.classList.contains('is-open')) return;
      wrap.classList.remove('is-open');
      card.setAttribute('aria-expanded', 'false');
    }

    // 鼠标：整块交互区（按钮 + 说明框）保持展开，离开才收回
    wrap.addEventListener('pointerenter', function (ev) {
      if (ev.pointerType === 'mouse') open();
    });
    wrap.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType === 'mouse') close();
    });

    // 键盘：聚焦即展开，移出焦点范围后收回
    wrap.addEventListener('focusin', open);
    wrap.addEventListener('focusout', function () {
      window.setTimeout(function () {
        if (!wrap.contains(document.activeElement)) close();
      }, 0);
    });

    // 触屏：第一次点按只展开，第二次点按才进入原有点击逻辑
    wrap.addEventListener('click', function (ev) {
      if (ev.target.closest('.pop')) return;
      if (wrap.classList.contains('is-open')) return;
      ev.preventDefault();
      ev.stopPropagation();
      open();
    }, true);

    // 触屏的点按展开由上面的 capture click 完成：
    // 第一次点按只展开并拦住点击，第二次点按才交给原按钮逻辑。
  });

  // 触屏点空白处收回
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('.mode-wrap')) return;
    wraps.forEach(function (w) { w.classList.remove('is-open'); });
    [].forEach.call(document.querySelectorAll('.mode-card'), function (c) {
      c.setAttribute('aria-expanded', 'false');
    });
  }, true);

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    wraps.forEach(function (w) { w.classList.remove('is-open'); });
  });

  /* ======================================================================
     3D 展示区
     ----------------------------------------------------------------------
     默认是程序化的环绕点阵（与页面同色，无边框、无播放器）；
     接入真实模型时调用：
         window.__stage.useGLB('./models/longma.glb')
     或回到程序化版本：
         window.__stage.useProcedural()
     ====================================================================== */
  (function initStage() {
    var host = document.querySelector('.stage');
    if (!host) return;
    var canvas = host.querySelector('canvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var W = 1, H = 1, dpr = 1, cx = 0, cy = 0, focal = 600, unit = 130;
    var dots = [], rings = [];
    var raf = 0, running = false;
    var mode = 'procedural';
    var alive = true;

    var sprite = (function () {
      var s = document.createElement('canvas');
      s.width = s.height = 64;
      var g = s.getContext('2d');
      var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(198,255,228,1)');
      grad.addColorStop(0.22, 'rgba(99,216,163,0.88)');
      grad.addColorStop(0.5, 'rgba(76,196,141,0.26)');
      grad.addColorStop(1, 'rgba(76,196,141,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(32, 32, 32, 0, Math.PI * 2);
      g.fill();
      return s;
    })();

    (function buildGeometry() {
      var lat, i, n, a, ph;
      for (lat = -75; lat <= 75; lat += 15) {
        ph = lat * Math.PI / 180;
        n = Math.max(14, Math.round(34 * Math.cos(ph)));
        for (i = 0; i < n; i++) {
          a = (i / n) * Math.PI * 2;
          dots.push({
            x: Math.cos(ph) * Math.cos(a),
            y: Math.sin(ph),
            z: Math.cos(ph) * Math.sin(a)
          });
        }
      }
      rings.push({ r: 1.42, tilt: 1.18, spin: 0.42, alpha: 0.075 });
      rings.push({ r: 1.30, tilt: 1.02, spin: 0.58, alpha: 0.13 });
      rings.push({ r: 1.14, tilt: 0.32, spin: -0.36, alpha: 0.11 });
    })();

    /* 展示区高度是原来的两倍，模型本身只放大 50%：
       focal 与图片像素尺寸成正比，故按原比例折算。 */
    var BASE_FOCAL = 1.95;   // 原尺寸下的焦距系数
    var GLOBE_GROWTH = 1.5;  // 图像放大 50%

    function resize() {
      var rect = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * 0.5;
      focal = (H / 2) * BASE_FOCAL * GLOBE_GROWTH;

      unit = focal / 4.4;        // 中心处的投影比例：世界 1 单位 → 多少像素
    }

    var P = [0, 0, 0, 0];

    function project(x, y, z, tilt, yaw) {
      var cyw = Math.cos(yaw), syw = Math.sin(yaw);
      var X = x * cyw + z * syw;
      var Z = -x * syw + z * cyw;
      var cxt = Math.cos(tilt), sxt = Math.sin(tilt);
      var Y = y * cxt - Z * sxt;
      var Z2 = y * sxt + Z * cxt;
      var zc = Z2 + 4.4;
      if (zc < 0.3) zc = 0.3;
      var s = focal / zc;
      P[0] = cx + X * s;
      P[1] = cy + Y * s;
      P[2] = s;
      P[3] = Z2;
      return P;
    }

    function drawRing(ring, yaw) {
      var i, ang, p;
      var tilt = ring.tilt + Math.sin(yaw * 0.6 + ring.tilt) * 0.05;
      var spin = yaw * ring.spin;
      ctx.beginPath();
      for (i = 0; i <= 72; i++) {
        ang = (i / 72) * Math.PI * 2;
        p = project(Math.cos(ang) * ring.r, 0, Math.sin(ang) * ring.r, tilt, spin);
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.strokeStyle = 'rgba(99,216,163,' + ring.alpha + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function render(t) {
      ctx.clearRect(0, 0, W, H);

      var yaw = t * 0.00026;
      var tilt = 0.40 + Math.sin(t * 0.00021) * 0.05;
      // 浮动幅度按球体自身尺度给，展示区变高也不会被放大
      cy = H * 0.5 + Math.sin(t * 0.00042) * unit * 0.04;

      // 落影：压在球体下方，把悬浮物"钉"在页面里
      var shadowY = cy + unit * 1.24;
      var shadow = ctx.createRadialGradient(cx, shadowY, 0, cx, shadowY, unit * 1.1);
      shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
      shadow.addColorStop(0.55, 'rgba(0,0,0,0.18)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(cx, shadowY);
      ctx.scale(1, 0.24);
      ctx.translate(-cx, -shadowY);
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(cx, shadowY, unit * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 中心核光
      var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 1.5);
      core.addColorStop(0, 'rgba(99,216,163,0.22)');
      core.addColorStop(0.42, 'rgba(76,196,141,0.06)');
      core.addColorStop(1, 'rgba(76,196,141,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, W, H);

      drawRing(rings[0], yaw);
      drawRing(rings[1], yaw);
      drawRing(rings[2], yaw);

      var i, d, p, depth, alpha, size;
      for (i = 0; i < dots.length; i++) {
        d = dots[i];
        p = project(d.x, d.y, d.z, tilt, yaw);
        depth = (p[3] + 1) * 0.5;
        if (depth < 0) depth = 0;
        if (depth > 1) depth = 1;
        alpha = 0.14 + 0.82 * depth * depth;
        size = unit * 0.078 * (0.78 + depth * 0.6);
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, p[0] - size * 0.5, p[1] - size * 0.5, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      if (!running || !alive) return;
      if (mode === 'procedural') render(now);
      raf = requestAnimationFrame(loop);
    }

    function startLoop() {
      if (running || !alive) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stopLoop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    if (reduce) {
      render(2600);
    } else {
      startLoop();
    }

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () {
        if (mode !== 'procedural') return;
        resize();
        if (reduce) render(2600);
      }).observe(host);
    } else {
      window.addEventListener('resize', function () {
        if (mode !== 'procedural') return;
        resize();
        if (reduce) render(2600);
      });
    }

    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        if (mode !== 'procedural' || reduce) return;
        if (entries[0].isIntersecting) startLoop();
        else stopLoop();
      }, { threshold: 0 }).observe(host);
    }

    document.addEventListener('visibilitychange', function () {
      if (mode !== 'procedural' || reduce) return;
      if (document.hidden) stopLoop();
      else startLoop();
    });

    /* ---------------- 真实模型接口 ---------------- */
    var glStop = null;

    function useProcedural() {
      if (glStop) {
        try { glStop(); } catch (e) {}
        glStop = null;
      }
      if (mode === 'procedural') return Promise.resolve(true);
      mode = 'procedural';
      stopLoop();
      var fresh = document.createElement('canvas');
      if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);
      canvas = fresh;
      ctx = canvas.getContext('2d', { alpha: true });
      resize();
      if (reduce) render(2600); else startLoop();
      return Promise.resolve(true);
    }

    function useGLB(url) {
      if (!url) return Promise.reject(new Error('useGLB 需要一个 .glb 地址'));
      return Promise.all([
        import('./samples/three-webxr-hittest/libs/three.module.js'),
        import('./samples/three-webxr-hittest/libs/jsm/loaders/GLTFLoader.js')
      ]).then(function (mods) {
        var THREE = mods[0];
        var GLTFLoader = mods[1].GLTFLoader;
        stopLoop();
        mode = 'glb';

        var glCanvas = document.createElement('canvas');
        if (canvas.parentNode) canvas.parentNode.replaceChild(glCanvas, canvas);
        canvas = glCanvas;

        var renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

        scene.add(new THREE.HemisphereLight(0xd9fff0, 0x0b0f10, 1.1));
        var key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(2.4, 4, 3);
        scene.add(key);
        var rim = new THREE.DirectionalLight(0x63d8a3, 1.2);
        rim.position.set(-3, 1.6, -2.4);
        scene.add(rim);

        var group = new THREE.Group();
        scene.add(group);
        var mixer = null;

        new GLTFLoader().load(url, function (gltf) {
          var root = gltf.scene;
          var box = new THREE.Box3().setFromObject(root);
          var size = box.getSize(new THREE.Vector3());
          var center = box.getCenter(new THREE.Vector3());
          var k = 1 / Math.max(size.x, size.y, size.z || 1);
          root.scale.setScalar(k);
          root.position.set(-center.x * k, -center.y * k, -center.z * k);
          group.add(root);
          if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(root);
            mixer.clipAction(gltf.animations[0]).play();
          }
        }, undefined, function (err) {
          console.warn('[stage] GLB 载入失败，回到程序化展示：', err && err.message);
          useProcedural();
        });

        function fit() {
          var rect = host.getBoundingClientRect();
          renderer.setSize(rect.width, rect.height, false);
          camera.aspect = rect.width / Math.max(rect.height, 1);
          camera.updateProjectionMatrix();
        }
        fit();
        window.addEventListener('resize', fit);

        glStop = function () {
          renderer.setAnimationLoop(null);
          window.removeEventListener('resize', fit);
          renderer.dispose();
        };

        var t0 = performance.now();
        renderer.setAnimationLoop(function (now) {
          var t = (now - t0) / 1000;
          group.rotation.y = t * 0.28;
          group.position.y = Math.sin(t * 0.7) * 0.02;
          if (mixer) mixer.update(0.016);
          renderer.render(scene, camera);
        });
        return true;
      }).catch(function (err) {
        console.warn('[stage] three.js 不可用，继续使用程序化展示：', err && err.message);
        return false;
      });
    }

    window.__stage = {
      get mode() { return mode; },
      dots: function () { return dots.length; },
      useGLB: useGLB,
      useProcedural: useProcedural
    };
  })();
})();
