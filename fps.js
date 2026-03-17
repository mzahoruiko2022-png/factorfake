(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  const PLAYER_SPEED       = 0.15;
  const PLAYER_HEALTH      = 100;
  const ENEMY_BULLET_SPEED = 0.25;
  const BASE_SENSITIVITY   = 0.0022;
  const ARENA_SIZE         = 40;
  const WALL_HEIGHT        = 5;
  const DAMAGE_POPUP_MS    = 850;
  const JUMP_FORCE         = 9;
  const GRAVITY            = 22;
  const EYE_HEIGHT         = 1.6;
  const TOTAL_WAVES        = 5;
  const ORB_PICKUP_RADIUS  = 1.1;
  const ORB_HEAL           = 30;

  // Enemy types: step = world-units per frame (≈60fps), shootCd = frames between shots
  const ENEMY_TYPES = {
    grunt: { hp: 100, step: 0.040, shootCd: 90,  damage: 8,  scale: 1.00, armorColor: 0x1c1c28, armorRough: 0.40, armorMetal: 0.85, visorColor: 0xff2200, eyeColor: 0xff1100, accentColor: 0x8b1111, label: 'GRUNT',  score: 100 },
    scout: { hp:  45, step: 0.075, shootCd: 60,  damage: 5,  scale: 0.80, armorColor: 0xb0bcc8, armorRough: 0.18, armorMetal: 0.92, visorColor: 0x22ff44, eyeColor: 0x00ff33, accentColor: 0x1a6633, label: 'SCOUT',  score: 150 },
    tank:  { hp: 280, step: 0.022, shootCd: 130, damage: 20, scale: 1.45, armorColor: 0x090912, armorRough: 0.12, armorMetal: 0.96, visorColor: 0xff8800, eyeColor: 0xff6600, accentColor: 0x773800, label: 'TANK',   score: 300 },
  };

  // Each wave: array of { type, count }
  const WAVE_CONFIGS = [
    [{ type:'grunt', count:4 }],
    [{ type:'grunt', count:3 }, { type:'scout', count:2 }],
    [{ type:'grunt', count:2 }, { type:'scout', count:3 }, { type:'tank', count:1 }],
    [{ type:'scout', count:3 }, { type:'tank',  count:2 }, { type:'grunt', count:2 }],
    [{ type:'scout', count:4 }, { type:'tank',  count:3 }, { type:'grunt', count:2 }],
  ];

  // ─── Loot & Rarity ────────────────────────────────────────────────────────
  const INVENTORY_SIZE  = 5;
  // weapon index → rarity tier
  const WEAPON_RARITY   = ['common','uncommon','rare','epic','uncommon','legendary','rare','epic','rare'];
  const RARITY_COLORS   = { common:0xaaaaaa, uncommon:0x22cc55, rare:0x4488ff, epic:0xaa44ff, legendary:0xff8c00 };
  const RARITY_LABELS   = { common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY' };
  // which weapons each enemy type can drop (weighted by repetition)
  const LOOT_POOLS = {
    scout: [0, 0, 4, 4, 1],          // 40% pistol, 40% SMG, 20% shotgun
    grunt: [1, 2, 2, 8, 8],          // 20% shotgun, 40% AR, 40% burst
    tank:  [3, 3, 7, 6, 5],          // 40% sniper, 20% minigun, 20% laser, 20% launcher
  };

  // ─── Weapons ──────────────────────────────────────────────────────────────
  const WEAPONS = [
    { key:1, name:'PISTOL',        damage:25, fireRateMs:320,  auto:false, pellets:1, spread:0,     aoe:0,   spinup:0,  burst:0, recoilAmt:0.06, barrelLen:0.12, bodyColor:0x888888, clipSize:12,  reloadMs:1100, perk:'+ Accurate · no spread',           downside:'- Low damage per shot'            },
    { key:2, name:'SHOTGUN',       damage:10, fireRateMs:880,  auto:false, pellets:7, spread:0.13,  aoe:0,   spinup:0,  burst:0, recoilAmt:0.25, barrelLen:0.22, bodyColor:0x884400, clipSize:6,   reloadMs:2000, perk:'+ 7 pellets · destroys CQB',       downside:'- Slow · falls off at range'      },
    { key:3, name:'ASSAULT RIFLE', damage:14, fireRateMs:90,   auto:true,  pellets:1, spread:0.022, aoe:0,   spinup:0,  burst:0, recoilAmt:0.07, barrelLen:0.2,  bodyColor:0x445566, clipSize:30,  reloadMs:1800, perk:'+ Full auto · consistent DPS',     downside:'- Medium dmg · slight spread'     },
    { key:4, name:'SNIPER',        damage:90, fireRateMs:1700, auto:false, pellets:1, spread:0,     aoe:0,   spinup:0,  burst:0, recoilAmt:0.38, barrelLen:0.32, bodyColor:0x336633, clipSize:5,   reloadMs:2400, perk:'+ 90 dmg · 1-shot potential',      downside:'- Very slow fire rate'            },
    { key:5, name:'SMG',           damage:7,  fireRateMs:55,   auto:true,  pellets:1, spread:0.055, aoe:0,   spinup:0,  burst:0, recoilAmt:0.03, barrelLen:0.1,  bodyColor:0x666644, clipSize:40,  reloadMs:2000, perk:'+ Blazing fast fire rate',         downside:'- Weak per shot · spreads'        },
    { key:6, name:'LAUNCHER',      damage:60, fireRateMs:2200, auto:false, pellets:1, spread:0,     aoe:4.5, spinup:0,  burst:0, recoilAmt:0.55, barrelLen:0.24, bodyColor:0x993322, clipSize:2,   reloadMs:3200, perk:'+ AOE splash · hits all nearby',   downside:'- Extremely slow reload'          },
    { key:7, name:'LASER',         damage:4,  fireRateMs:25,   auto:true,  pellets:1, spread:0,     aoe:0,   spinup:0,  burst:0, recoilAmt:0,    barrelLen:0.16, bodyColor:0x2244cc, clipSize:60,  reloadMs:1600, perk:'+ Zero recoil · pinpoint aim',     downside:'- Very low per-tick damage'       },
    { key:8, name:'MINIGUN',       damage:6,  fireRateMs:45,   auto:true,  pellets:1, spread:0.07,  aoe:0,   spinup:0.9, burst:0, recoilAmt:0.02, barrelLen:0.2,  bodyColor:0x777777, clipSize:100, reloadMs:3500, perk:'+ Enormous sustained DPS',         downside:'- Slow spin-up · wide spread'     },
    { key:9, name:'BURST RIFLE',   damage:20, fireRateMs:400,  auto:false, pellets:1, spread:0.012, aoe:0,   spinup:0,  burst:3, recoilAmt:0.1,  barrelLen:0.18, bodyColor:0x663399, clipSize:21,  reloadMs:1800, perk:'+ 3-round burst · high burst dmg', downside:'- Pause between bursts'           },
  ];

  // ─── Audio Engine ─────────────────────────────────────────────────────────
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function _noiseBuf(ctx, dur) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function _noise(ctx, t, vol, hz, type, dur, Q = 1) {
    const src  = ctx.createBufferSource();
    src.buffer = _noiseBuf(ctx, dur + 0.05);
    const filt = ctx.createBiquadFilter();
    filt.type         = type;
    filt.frequency.value = hz;
    filt.Q.value      = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + dur + 0.06);
  }

  function _tone(ctx, t, vol, f0, f1, dur, type = 'sine') {
    const osc = ctx.createOscillator();
    osc.type  = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.06);
  }

  function playGunshot(weaponKey) {
    const ctx = ensureAudio();
    const t   = ctx.currentTime;
    switch (weaponKey) {
      case 1: // Pistol — sharp mid crack
        _tone (ctx, t, 0.55, 180,  80, 0.18);
        _noise(ctx, t, 0.40, 2500, 'bandpass', 0.09, 0.9);
        break;
      case 2: // Shotgun — big layered boom
        _tone (ctx, t, 1.1,  90,  32,  0.60);
        _tone (ctx, t, 0.5,  160, 60,  0.30);
        _noise(ctx, t, 0.55, 900, 'lowpass',  0.28, 0.5);
        break;
      case 3: // Assault Rifle — punchy medium crack
        _tone (ctx, t, 0.50, 160,  90, 0.14);
        _noise(ctx, t, 0.38, 2200, 'bandpass', 0.10, 0.9);
        break;
      case 4: // Sniper — loud crack + deep rumble
        _tone (ctx, t, 0.90, 130,  45, 0.60);
        _noise(ctx, t, 0.65, 1800, 'bandpass', 0.40, 0.6);
        _noise(ctx, t, 0.25, 5500, 'highpass', 0.06, 0.5);
        break;
      case 5: // SMG — light fast tick
        _tone (ctx, t, 0.30, 200, 110, 0.09);
        _noise(ctx, t, 0.28, 3000, 'bandpass', 0.065, 1.2);
        break;
      case 6: // Launcher — earth-shaking BOOM
        _tone (ctx, t, 1.40,  60,  22, 0.95);
        _tone (ctx, t, 0.70, 200,  55, 0.55);
        _noise(ctx, t, 0.55, 400, 'lowpass',  0.55, 0.4);
        break;
      case 7: // Laser — sci-fi zap
        _tone (ctx, t, 0.35, 750,  90, 0.18, 'sawtooth');
        _tone (ctx, t, 0.18, 1500, 200, 0.14, 'sine');
        break;
      case 8: // Minigun — rapid mechanical click
        _tone (ctx, t, 0.22, 230, 130, 0.05);
        _noise(ctx, t, 0.20, 2800, 'bandpass', 0.045, 1.5);
        break;
      case 9: // Burst Rifle — crisp snap
        _tone (ctx, t, 0.48, 175,  85, 0.15);
        _noise(ctx, t, 0.35, 2300, 'bandpass', 0.10, 1.0);
        break;
    }
  }

  function playHitSound() {
    const ctx = ensureAudio();
    const t   = ctx.currentTime;
    // GTA-style hit tick — clean high ping
    _tone (ctx, t, 0.28, 1050, 1050, 0.055, 'sine');
    _noise(ctx, t, 0.12, 5000, 'highpass', 0.035, 0.5);
  }

  function playWheelOpenSound() {
    const ctx = ensureAudio();
    const t   = ctx.currentTime;
    // Metallic whoosh — GTA weapon wheel vibe
    _noise(ctx, t,      0.22, 1600, 'bandpass', 0.20, 2.5);
    _tone (ctx, t,      0.14,  280,  580, 0.18, 'sine');
    _tone (ctx, t + 0.05, 0.09, 900, 380, 0.14, 'sine');
  }

  // ─── Shared enemy materials (created once) ────────────────────────────────
  let matGun;
  function buildEnemyMaterials() {
    matGun = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.7 });
  }

  // ─── State ────────────────────────────────────────────────────────────────
  let scene, camera, renderer, clock;
  let moveForward, moveBackward, moveLeft, moveRight;
  let yaw = 0, pitch = 0;
  let playerVy = 0, playerGrounded = true;
  let velocity  = new THREE.Vector3();
  let direction = new THREE.Vector3();
  let raycaster = new THREE.Raycaster();
  let mouse     = new THREE.Vector2(0, 0);
  let vec3Proj  = new THREE.Vector3();

  let playerHealth, kills, score, gameRunning;
  let currentWave = 1;
  let healthOrbs  = [];
  let waveInProgress = false;
  let playerInventory = new Array(INVENTORY_SIZE).fill(null); // {weaponIdx,ammo}|null
  let currentSlot     = 0;
  let weaponDrops     = [];
  let enemies = [], enemyBullets = [], damagePopups = [];
  let obstacleObjects = [];
  let bulletRaycaster = new THREE.Raycaster();
  const downRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 8);
  let viewmodel, muzzleFlash;
  let shootRecoil   = 0;
  let mouseDown     = false;
  let lastShotTime  = 0;
  let burstFiring   = false;
  let spinupProgress = 0;
  let currentWeaponIdx = 0;
  let currentAmmo   = 0;
  let isReloading   = false;
  let reloadStartTime = 0;

  let startScreen, hudEl, gameOverEl, winScreen;
  let healthFill, healthText, scoreEl;
  let weaponNameEl, weaponPerkEl, weaponDownEl;
  let dmgContainer;
  let ammoText, reloadBarFill, reloadBarWrap;
  let composer = null;

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0xb4d0ee, 0.007);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, EYE_HEIGHT, 0);
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    composer = null; // no post-processing

    clock = new THREE.Clock();

    buildEnemyMaterials();
    buildArena();
    addLights();
    buildViewmodel();

    startScreen   = document.getElementById('start-screen');
    hudEl         = document.getElementById('hud');
    gameOverEl    = document.getElementById('game-over');
    winScreen     = document.getElementById('win-screen');
    healthFill    = document.getElementById('health-fill');
    healthText    = document.getElementById('health-text');
    scoreEl       = document.getElementById('score');
    weaponNameEl  = document.getElementById('weapon-name');
    weaponPerkEl  = document.getElementById('weapon-perk');
    weaponDownEl  = document.getElementById('weapon-down');
    dmgContainer  = document.getElementById('damage-numbers');
    ammoText      = document.getElementById('ammo-text');
    reloadBarFill = document.getElementById('reload-bar-fill');
    reloadBarWrap = document.getElementById('reload-bar-wrap');

    document.getElementById('start-btn').addEventListener('click', () => { ensureAudio(); startGame(); });
    document.getElementById('restart-btn').addEventListener('click', () => { ensureAudio(); startGame(); });
    document.getElementById('win-restart-btn').addEventListener('click', () => { ensureAudio(); startGame(); });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', onResize);

    hudEl.classList.add('hidden');
    document.getElementById('weapon-hud').classList.add('hidden');
  }

  // ─── Arena ────────────────────────────────────────────────────────────────
  function buildArena() {
    obstacleObjects = [];

    // ── Sky dome  (atmospheric gradient + sun-side warmth) ────────────────
    const SKY_R = 380;
    const skyGeo = new THREE.SphereGeometry(SKY_R, 48, 28);
    const skyPos = skyGeo.attributes.position;
    const skyColors = new Float32Array(skyPos.count * 3);
    // Sun direction (matches the directional light below)
    const sunDir = new THREE.Vector3(130, 160, -200).normalize();
    for (let i = 0; i < skyPos.count; i++) {
      const vx = skyPos.getX(i), vy = skyPos.getY(i), vz = skyPos.getZ(i);
      const len = Math.sqrt(vx*vx + vy*vy + vz*vz);
      const nx = vx/len, ny = vy/len, nz = vz/len;
      const t = Math.max(0, Math.min(1, (ny + 1) * 0.5)); // 0=bottom, 1=top
      const sunDot   = nx*sunDir.x + ny*sunDir.y + nz*sunDir.z;
      const sunGlow  = Math.max(0, (sunDot - 0.55) / 0.45);   // soft sun corona
      const horizGlow = Math.max(0, (sunDot - 0.20) / 0.80) * Math.max(0, 1 - t * 3.5); // horizon warmth

      // Base sky: horizon sky-blue → deep azure zenith
      let r = t < 0.5 ? 0.68 + (0.36 - 0.68)*(t/0.5)  : 0.36 + (0.11 - 0.36)*((t-0.5)/0.5);
      let g = t < 0.5 ? 0.84 + (0.60 - 0.84)*(t/0.5)  : 0.60 + (0.32 - 0.60)*((t-0.5)/0.5);
      let b = t < 0.5 ? 0.97 + (0.88 - 0.97)*(t/0.5)  : 0.88 + (0.68 - 0.88)*((t-0.5)/0.5);

      // Sun corona
      r += sunGlow * 0.55; g += sunGlow * 0.35; b += sunGlow * 0.05;
      // Warm horizon scattering
      r += horizGlow * 0.38; g += horizGlow * 0.14; b -= horizGlow * 0.12;

      skyColors[i*3]   = Math.min(1, r);
      skyColors[i*3+1] = Math.min(1, g);
      skyColors[i*3+2] = Math.min(1, Math.max(0, b));
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
    scene.add(new THREE.Mesh(skyGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

    // ── Sun disc + layered halo ────────────────────────────────────────────
    const SUN_POS = new THREE.Vector3(130, 160, -200);
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(10, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff8e0, fog: false })
    );
    sunDisc.position.copy(SUN_POS);
    scene.add(sunDisc);
    // Three halo rings of decreasing opacity
    [30, 55, 90].forEach((r, k) => {
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.06 - k*0.015, fog: false })
      );
      halo.position.copy(SUN_POS);
      scene.add(halo);
    });

    // ── God rays (light shaft cone from sun) ──────────────────────────────
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfff5cc, transparent: true, opacity: 0.035,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    const ray = new THREE.Mesh(new THREE.ConeGeometry(80, 220, 8, 1, true), rayMat);
    ray.position.set(50, 110, -90);
    ray.rotation.z = -0.28;
    ray.rotation.x = 0.1;
    scene.add(ray);

    // ── Procedural ground texture ──────────────────────────────────────────
    function makeGroundTex() {
      const S = 1024;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a6e15'; ctx.fillRect(0, 0, S, S);
      // Varied green patches
      for (let i = 0; i < 520; i++) {
        const x = Math.random() * S, y = Math.random() * S;
        const rx = 6 + Math.random() * 38, ry = 4 + Math.random() * 22;
        const hue = 88 + Math.random() * 36, sat = 42 + Math.random() * 30, lit = 17 + Math.random() * 22;
        ctx.globalAlpha = 0.22 + Math.random() * 0.42;
        ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.random() * Math.PI);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Dirt/mud patches
      for (let i = 0; i < 45; i++) {
        const x = Math.random() * S, y = Math.random() * S, r = 8 + Math.random() * 24;
        ctx.globalAlpha = 0.12 + Math.random() * 0.22;
        ctx.fillStyle = `hsl(${28 + Math.random()*16},28%,${22 + Math.random()*14}%)`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Pale dry patches
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * S, y = Math.random() * S, r = 4 + Math.random() * 14;
        ctx.globalAlpha = 0.08 + Math.random() * 0.18;
        ctx.fillStyle = `hsl(${70 + Math.random()*30},55%,${55 + Math.random()*20}%)`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(22, 22);
      return t;
    }

    // ── Ground ────────────────────────────────────────────────────────────
    const groundTex = makeGroundTex();
    const groundGeo = new THREE.PlaneGeometry(ARENA_SIZE * 2 + 80, ARENA_SIZE * 2 + 80, 80, 80);
    const gPosAttr = groundGeo.attributes.position;
    const gArr = new Float32Array(gPosAttr.array);
    for (let i = 0; i < gPosAttr.count; i++) {
      const x = gArr[i * 3], z = gArr[i * 3 + 2];
      const dist = Math.sqrt(x*x + z*z);
      if (dist > ARENA_SIZE * 0.85) {
        gArr[i * 3 + 1] = Math.sin(x*0.11 + 0.3)*Math.cos(z*0.09 + 0.7) * 1.8;
      }
    }
    groundGeo.setAttribute('position', new THREE.BufferAttribute(gArr, 3));
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
      map: groundTex, roughness: 0.95, metalness: 0.0,
    }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Wet puddles (reflective patches)
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x5080a8, roughness: 0.04, metalness: 0.82, transparent: true, opacity: 0.65 });
    [[5,-8,1.4],[-8,3,1.1],[-3,12,0.9],[9,-4,1.6],[-12,-5,1.2],[0,7,0.8]].forEach(([px,pz,pr]) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(pr, 14), puddleMat);
      m.rotation.x = -Math.PI/2; m.position.set(px, 0.01, pz);
      scene.add(m);
    });

    // ── Grass blades ──────────────────────────────────────────────────────
    const dummy = new THREE.Object3D();
    const instColor = new THREE.Color();

    // Grass — fast instanced blades, looks dense without killing framerate
    const bladeColors = [0x2e7a0c,0x389614,0x236008,0x42a81a,0x2c7010,0x3c9018,0x4eb020,0x1e5808];
    [ [300000,0.018,0.08,0x338810],
      [300000,0.018,0.08,0x2a7a0c],
      [200000,0.022,0.13,0x409018],
      [150000,0.020,0.17,0x4aaa1c],
    ].forEach(([count, w, h, col], pass) => {
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(0, h * 0.5, 0);
      const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const baseAngle = (pass / 4) * Math.PI;
      for (let i = 0; i < count; i++) {
        dummy.position.set((Math.random()-0.5)*(ARENA_SIZE*2-1), 0, (Math.random()-0.5)*(ARENA_SIZE*2-1));
        dummy.rotation.set(0, baseAngle + Math.random()*Math.PI*2, (Math.random()-0.5)*0.3);
        dummy.scale.set(1, 0.6+Math.random()*0.9, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        instColor.setHex(bladeColors[Math.floor(Math.random()*bladeColors.length)]);
        mesh.setColorAt(i, instColor);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    });

    // ── Flowers ───────────────────────────────────────────────────────────
    const flowerColors = [0xffee44, 0xff88aa, 0xffffff, 0xff4488, 0xaaddff, 0xff6600];
    const flowerGeo = new THREE.SphereGeometry(0.065, 6, 4);
    flowerColors.forEach(fc => {
      const fMesh = new THREE.InstancedMesh(flowerGeo, new THREE.MeshLambertMaterial({
        color: fc
      }), 130);
      for (let i = 0; i < 130; i++) {
        dummy.position.set((Math.random()-0.5)*(ARENA_SIZE*2-6), 0.3+Math.random()*0.12, (Math.random()-0.5)*(ARENA_SIZE*2-6));
        dummy.rotation.set(0,0,0); dummy.scale.setScalar(1); dummy.updateMatrix();
        fMesh.setMatrixAt(i, dummy.matrix);
      }
      fMesh.instanceMatrix.needsUpdate = true;
      scene.add(fMesh);
    });

    // ── Clouds ────────────────────────────────────────────────────────────
    for (let c = 0; c < 18; c++) {
      const cg = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 5);
      for (let p = 0; p < puffs; p++) {
        const r = 5 + Math.random() * 9;
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(r, 9, 7),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.82 + Math.random()*0.12 })
        );
        puff.position.set((Math.random()-0.5)*18, (Math.random()-0.5)*4, (Math.random()-0.5)*10);
        cg.add(puff);
      }
      cg.position.set((Math.random()-0.5)*340, 60+Math.random()*30, (Math.random()-0.5)*340);
      scene.add(cg);
    }

    // ── Distant hills ─────────────────────────────────────────────────────
    const hillColors = [0x3a7414, 0x448018, 0x50901e, 0x3c7016];
    const hillPositions = [
      [0,-ARENA_SIZE-12],[ARENA_SIZE+12,0],[0,ARENA_SIZE+12],[-ARENA_SIZE-12,0],
      [ARENA_SIZE+10,-ARENA_SIZE-10],[-ARENA_SIZE-10,ARENA_SIZE+10],
      [ARENA_SIZE+10,ARENA_SIZE+10],[-ARENA_SIZE-10,-ARENA_SIZE-10],
      [ARENA_SIZE*0.7,-ARENA_SIZE-18],[-ARENA_SIZE*0.7,ARENA_SIZE+18],
    ];
    hillPositions.forEach(([hx, hz], k) => {
      const sz = 10 + Math.random()*8;
      const h = new THREE.Mesh(
        new THREE.SphereGeometry(sz, 12, 8),
        new THREE.MeshStandardMaterial({ color: hillColors[k % hillColors.length], roughness: 1.0 })
      );
      h.scale.set(1.5, 0.48 + Math.random()*0.2, 1.5);
      h.position.set(hx, -4, hz);
      h.receiveShadow = true;
      scene.add(h);
    });

    // ── Obstacle helpers ──────────────────────────────────────────────────
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.95, metalness: 0.0 });
    const rockMat2 = new THREE.MeshStandardMaterial({ color: 0xa09888, roughness: 0.80, metalness: 0.05 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888070, roughness: 0.85, metalness: 0.05 });
    const logMat   = new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 1.0,  metalness: 0.0  });
    const woodMat  = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.9,  metalness: 0.0  });

    // Smooth rounded rock using high-segment sphere squashed to rock proportions
    function addRock(x, z, sx, sy, sz, ry) {
      const mat = Math.random() > 0.5 ? rockMat : rockMat2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), mat);
      m.scale.set(sx, sy * 0.65, sz);
      m.position.set(x, sy * 0.35, z);
      m.rotation.y = ry || Math.random() * Math.PI;
      m.rotation.x = (Math.random() - 0.5) * 0.15;
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const col = new THREE.Mesh(new THREE.BoxGeometry(sx * 1.8, sy * 0.9, sz * 1.8));
      col.position.set(x, sy * 0.45, z);
      col.visible = false;
      scene.add(col);
      obstacleObjects.push(col);
    }

    function addLog(x, z, len, ry) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.30, len, 10), logMat);
      m.rotation.set(0, ry, Math.PI / 2);
      m.position.set(x, 0.28, z);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const col = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.6));
      col.position.set(x, 0.3, z);
      col.rotation.y = ry;
      col.visible = false;
      scene.add(col);
      obstacleObjects.push(col);
    }

    // Smooth stone wall — single solid slab with rounded top row of stones
    function addStoneWall(x, z, len, ry) {
      const g = new THREE.Group();
      // Main wall body — smooth box
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 0.7), stoneMat);
      body.position.y = 0.6;
      body.castShadow = body.receiveShadow = true;
      g.add(body);
      // Smooth rounded cap stones along top
      const capCount = Math.ceil(len / 1.2);
      for (let ci = 0; ci < capCount; ci++) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), rockMat2);
        cap.scale.set(1.1, 0.55, 0.9);
        cap.position.set(-len/2 + ci * (len/capCount) + len/(capCount*2), 1.42, 0);
        cap.castShadow = true;
        g.add(cap);
      }
      g.position.set(x, 0, z);
      g.rotation.y = ry || 0;
      scene.add(g);
      const col = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 0.9));
      col.position.set(x, 0.9, z);
      col.rotation.y = ry || 0;
      col.visible = false;
      scene.add(col);
      obstacleObjects.push(col);
    }

    function addTree(x, z) {
      const g = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1a, roughness: 1.0 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 10), trunkMat);
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      g.add(trunk);
      const leafColors = [0x1e7a14, 0x267318, 0x196812, 0x2d8a1a, 0x145c0f];
      [[0,3.0,0,1.6],[-0.7,2.5,0.5,1.25],[0.6,2.6,-0.4,1.2],[0.3,3.6,0.2,1.1],[-0.3,3.5,-0.5,1.0]].forEach(([ox,oy,oz,r]) => {
        const lm = new THREE.MeshStandardMaterial({ color: leafColors[Math.floor(Math.random()*leafColors.length)], roughness: 1.0 });
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), lm);
        leaf.position.set(ox, oy, oz);
        leaf.castShadow = true;
        g.add(leaf);
      });
      g.position.set(x, 0, z);
      scene.add(g);
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6));
      col.position.set(x, 2, z);
      col.visible = false;
      scene.add(col);
      obstacleObjects.push(col);
    }

    // Smooth boulder — squashed sphere
    function addBoulder(x, z, r) {
      const mat = Math.random() > 0.4 ? rockMat : rockMat2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      m.scale.set(1.0 + Math.random()*0.3, 0.62 + Math.random()*0.2, 0.9 + Math.random()*0.3);
      m.position.set(x, r * 0.42, z);
      m.rotation.y = Math.random() * Math.PI;
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const col = new THREE.Mesh(new THREE.BoxGeometry(r*2.0, r*1.0, r*2.0));
      col.position.set(x, r*0.5, z);
      col.visible = false;
      scene.add(col);
      obstacleObjects.push(col);
    }

    // Wooden park bench
    function addBench(x, z, ry) {
      const g = new THREE.Group();
      // Seat plank
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.55), woodMat);
      seat.position.y = 0.52;
      seat.castShadow = seat.receiveShadow = true;
      g.add(seat);
      // Back rest
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.52, 0.10), woodMat);
      back.position.set(0, 0.95, -0.22);
      back.castShadow = true;
      g.add(back);
      // 4 legs
      [[-0.9, 0.22], [0.9, 0.22], [-0.9, -0.22], [0.9, -0.22]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 6), stoneMat);
        leg.position.set(lx, 0.26, lz);
        leg.castShadow = true;
        g.add(leg);
      });
      g.position.set(x, 0, z);
      g.rotation.y = ry || 0;
      scene.add(g);
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.7));
      col.position.set(x, 0.55, z);
      col.rotation.y = ry || 0;
      col.visible = false;
      scene.add(col);
      obstacleObjects.push(col);
    }

    // ── Place obstacles ────────────────────────────────────────────────────
    // Central rock cluster (good mid-map cover)
    addBoulder( 0,  0, 1.8);
    addRock( 2.5,  1.5, 2, 1.6, 1.8, 0);
    addRock(-2.2,  2.0, 1.8, 1.4, 2.0, 1);

    // Quadrant boulder formations
    addBoulder( 12,  10, 2.5); addRock( 14.5, 9, 1.6, 1.3, 1.8, 0);
    addBoulder(-12,  10, 2.2); addRock(-10.5, 12, 1.4, 1.5, 1.6, 1);
    addBoulder( 12, -10, 2.4); addRock( 10, -13, 2.0, 1.2, 2.0, 2);
    addBoulder(-12, -10, 2.6); addRock(-14.5,-11, 1.5, 1.4, 1.7, 0.5);

    // Fallen logs
    addLog(  8, -6, 5, 0.4);
    addLog( -8,  6, 5, -0.4);
    addLog( 22,  4, 6, 0.2);
    addLog(-22, -4, 6, -0.2);
    addLog(  4, 22, 5, Math.PI / 2 + 0.2);
    addLog( -4,-22, 5, Math.PI / 2 - 0.2);

    // Large solo boulders
    addBoulder( 25,  0, 3.0); addBoulder(-25,  0, 2.8);
    addBoulder(  0, 25, 3.2); addBoulder(  0,-25, 2.9);
    addBoulder( 28, 20, 2.2); addBoulder(-28,-20, 2.4);
    addBoulder( 20,-28, 2.0); addBoulder(-20, 28, 2.3);

    // Rock scatter
    addRock( 6, -6, 1.8, 1.4, 2, 0); addRock(-6, 6, 1.6, 1.6, 1.8, 1);
    addRock(22,  2, 1.4, 1.2, 1.6, 0.5); addRock(-22,-2, 1.5, 1.3, 1.7, 0.8);
    addRock( 0,-30, 2.5, 1.2, 2.5, 0); addRock( 0, 30, 2.2, 1.4, 2.0, 0);
    addRock(30,  0, 1.8, 1.0, 2.2, 0); addRock(-30, 0, 2.0, 1.2, 2.0, 0);

    // Benches — scattered around the arena
    addBench(  7,   7, Math.PI * 0.25);
    addBench( -7,  -7, Math.PI * 1.25);
    addBench( 18,  -5, 0);
    addBench(-18,   5, 0);
    addBench(  5,  18, Math.PI / 2);
    addBench( -5, -18, Math.PI / 2);
    addBench( 26,  26, Math.PI * 0.75);
    addBench(-26, -26, Math.PI * 1.75);

    // Trees — ring near edge + interior
    const treePts = [
      [ 35, -35], [ 35,  0], [ 35, 35], [ 0,  35], [-35,  35],
      [-35,  0], [-35,-35], [ 0,-35], [ 28, 16], [-28,-16],
      [ 16, 28], [-16,-28], [ 28,-16], [-28, 16],
      [ 18,  6], [-18, -6], [  6,-18], [ -6, 18],
      [ 24, 24], [-24,-24], [ 24,-24], [-24, 24],
    ];
    treePts.forEach(([tx, tz]) => addTree(tx, tz));
  }

  function addLights() {
    // Soft ambient fill — keeps shadows from going pitch black
    scene.add(new THREE.AmbientLight(0x8ab4d0, 0.55));

    // Main sun — warm, moderate intensity with shadows
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(60, 100, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003;
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 220;
    sun.shadow.camera.left   = -70;
    sun.shadow.camera.right  = 70;
    sun.shadow.camera.top    = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);

    // Soft sky fill from opposite direction
    const sky = new THREE.DirectionalLight(0xaac8e8, 0.28);
    sky.position.set(-40, 60, 80);
    scene.add(sky);
  }

  // ─── Enemy ────────────────────────────────────────────────────────────────
  function createEnemy(x, z, typeName) {
    const td = ENEMY_TYPES[typeName] || ENEMY_TYPES.grunt;
    const g  = new THREE.Group();

    const matArmor  = new THREE.MeshStandardMaterial({ color: td.armorColor, roughness: td.armorRough, metalness: td.armorMetal });
    const matAccent = new THREE.MeshStandardMaterial({ color: td.accentColor, roughness: 0.45, metalness: 0.65, emissive: new THREE.Color(td.accentColor), emissiveIntensity: 0.15 });
    const matChest  = new THREE.MeshStandardMaterial({ color: td.accentColor, roughness: 0.3, metalness: 0.7, emissive: new THREE.Color(td.visorColor), emissiveIntensity: 0.4 });
    const matVisor  = new THREE.MeshStandardMaterial({ color: td.visorColor, emissive: new THREE.Color(td.visorColor), emissiveIntensity: 1.8, transparent: true, opacity: 0.92 });
    const matEye    = new THREE.MeshStandardMaterial({ color: td.eyeColor,   emissive: new THREE.Color(td.eyeColor),   emissiveIntensity: 2.8 });

    // ── Feet / Boots ──────────────────────────────────
    [-0.19, 0.19].forEach(bx => {
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.32), matArmor);
      sole.position.set(bx, 0.04, 0.04);
      sole.castShadow = true;
      g.add(sole);
      const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.20), matArmor);
      ankle.position.set(bx, 0.14, 0);
      g.add(ankle);
      // Boot buckle strip
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), matAccent);
      buckle.position.set(bx, 0.14, 0.11);
      g.add(buckle);
    });

    // ── Legs ──────────────────────────────────────────
    const leftLegPivot  = new THREE.Group();
    const rightLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.19, 0.62, 0);
    rightLegPivot.position.set( 0.19, 0.62, 0);

    [leftLegPivot, rightLegPivot].forEach(pivot => {
      // Thigh
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.24), matArmor);
      thigh.position.y = -0.08;
      thigh.castShadow = true;
      pivot.add(thigh);
      // Thigh side plate
      const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.18), matAccent);
      thighPlate.position.set(0.13, -0.06, 0);
      pivot.add(thighPlate);
      // Knee pad (rounded sphere flattened)
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), matAccent);
      knee.scale.set(0.9, 0.55, 0.7);
      knee.position.set(0, -0.28, 0.12);
      pivot.add(knee);
      // Shin
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.30, 0.20), matArmor);
      shin.position.y = -0.47;
      pivot.add(shin);
      g.add(pivot);
    });

    // ── Pelvis / Waist ────────────────────────────────
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.22, 0.36), matArmor);
    pelvis.position.y = 0.72;
    pelvis.castShadow = true;
    g.add(pelvis);
    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.38), matAccent);
    belt.position.y = 0.63;
    g.add(belt);
    // Belt buckle
    const buckleBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), matGun);
    buckleBox.position.set(0, 0.63, 0.20);
    g.add(buckleBox);

    // ── Torso ─────────────────────────────────────────
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.64, 0.44), matArmor);
    torso.position.y = 1.14;
    torso.castShadow = true;
    g.add(torso);
    // Chest plate (front)
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.08), matChest);
    chestPlate.position.set(0, 1.16, 0.26);
    g.add(chestPlate);
    // Chest centre power node
    const powerNode = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), matVisor);
    powerNode.position.set(0, 1.22, 0.31);
    g.add(powerNode);
    // Chest panel lines
    [-0.14, 0.14].forEach(px => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.04), matGun);
      line.position.set(px, 1.12, 0.30);
      g.add(line);
    });
    // Side armour vents
    [-0.39, 0.39].forEach(sx => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.14), matAccent);
      vent.position.set(sx, 1.14, 0.08);
      g.add(vent);
      // Vent slots
      for (let vi = 0; vi < 3; vi++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), matGun);
        slot.position.set(sx, 1.02 + vi * 0.12, 0.16);
        g.add(slot);
      }
    });
    // Back pack / power unit
    const backPack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.14), matGun);
    backPack.position.set(0, 1.16, -0.29);
    g.add(backPack);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6), matAccent);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.12, 1.26, -0.37);
    g.add(exhaust);

    // ── Shoulders ────────────────────────────────────
    const leftArmPivot  = new THREE.Group();
    const rightArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.50, 1.36, 0);
    rightArmPivot.position.set( 0.50, 1.36, 0);

    [leftArmPivot, rightArmPivot].forEach((pivot, idx) => {
      // Rounded shoulder pauldron
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 7), matAccent);
      pauldron.scale.set(1.1, 0.75, 1.0);
      pauldron.position.set(idx===0 ? -0.04 : 0.04, 0.06, 0);
      pivot.add(pauldron);
      // Pauldron ridge
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.28), matGun);
      ridge.position.set(idx===0 ? -0.10 : 0.10, 0, 0);
      pivot.add(ridge);
      // Upper arm
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.40, 0.19), matArmor);
      upper.position.y = -0.26;
      upper.castShadow = true;
      pivot.add(upper);
      // Elbow joint (sphere)
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), matAccent);
      elbow.scale.set(0.9, 0.7, 0.9);
      elbow.position.y = -0.46;
      pivot.add(elbow);
      // Forearm
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), matArmor);
      lower.position.y = -0.64;
      pivot.add(lower);
      // Wrist guard
      const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.18), matAccent);
      wrist.position.y = -0.82;
      pivot.add(wrist);
      // Gun hand (right side)
      if (idx === 1) {
        const grip  = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), matArmor);
        grip.position.set(0, -0.90, 0);
        pivot.add(grip);
        const gun   = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.30), matGun);
        gun.position.set(0, -0.92, -0.18);
        pivot.add(gun);
        const barrel= new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), matGun);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, -0.92, -0.39);
        pivot.add(barrel);
        // Scope on top
        const scope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.14), matAccent);
        scope.position.set(0, -0.86, -0.18);
        pivot.add(scope);
      }
      g.add(pivot);
    });

    // ── Neck ─────────────────────────────────────────
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 8), matArmor);
    neck.position.y = 1.48;
    g.add(neck);
    // Collar ring
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), matAccent);
    collar.position.y = 1.46;
    g.add(collar);

    // ── Head ─────────────────────────────────────────
    // Base skull (slightly rounded box)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.52, 0.52), matArmor);
    head.position.y = 1.78;
    head.castShadow = true;
    g.add(head);
    // Forehead brow ridge
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.06, 0.08), matAccent);
    brow.position.set(0, 1.96, 0.26);
    g.add(brow);
    // Helmet dome top
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), matArmor);
    dome.scale.set(1, 0.60, 1);
    dome.position.set(0, 2.05, 0);
    g.add(dome);
    // Helmet crest (mohawk ridge)
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.44), matAccent);
    crest.position.set(0, 2.16, 0);
    g.add(crest);
    // Antenna
    const antennaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), matGun);
    antennaPole.position.set(0.22, 2.22, 0);
    g.add(antennaPole);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), matVisor);
    antennaTip.position.set(0.22, 2.34, 0);
    g.add(antennaTip);
    // Ear/comm guards
    [-0.29, 0.29].forEach(ex => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.30, 0.32), matAccent);
      ear.position.set(ex, 1.77, 0);
      g.add(ear);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), matGun);
      dish.scale.set(0.5, 1, 1);
      dish.position.set(ex < 0 ? -0.33 : 0.33, 1.82, 0);
      g.add(dish);
    });
    // Glowing visor (wide band)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.13, 0.07), matVisor);
    visor.position.set(0, 1.80, 0.28);
    g.add(visor);
    // Eye sockets behind visor
    const eyeGeo = new THREE.SphereGeometry(0.042, 7, 5);
    [-0.10, 0.10].forEach(ex => {
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(ex, 1.80, 0.30);
      g.add(eye);
    });
    // Chin plate
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), matArmor);
    chin.position.set(0, 1.64, 0.27);
    g.add(chin);
    // Chin vent slots
    [-0.08, 0.08].forEach(cx => {
      const cv = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), matAccent);
      cv.position.set(cx, 1.64, 0.32);
      g.add(cv);
    });

    // ── HP Bar (DOM element) ──────────────────────────
    const hpBar = document.createElement('div');
    hpBar.className = 'enemy-hp';
    const hpFill = document.createElement('div');
    hpFill.className = 'enemy-hp-fill';
    hpBar.appendChild(hpFill);
    document.getElementById('damage-numbers').appendChild(hpBar);

    g.scale.setScalar(td.scale);
    g.position.set(x, 0, z);
    g.userData = {
      typeName,
      health:       td.hp,
      maxHealth:    td.hp,
      step:         td.step,
      damage:       td.damage,
      shootCooldown: Math.floor(Math.random() * td.shootCd),
      shootCdMax:   td.shootCd,
      scoreValue:   td.score,
      hpBarOffset:  td.scale * 2.6,
      walkTime: Math.random() * Math.PI * 2,
      leftLegPivot,
      rightLegPivot,
      leftArmPivot,
      rightArmPivot,
      hpBar,
      hpFill,
    };
    scene.add(g);
    return g;
  }

  function spawnEnemies(wave) {
    enemies.forEach(e => {
      if (e.userData.hpBar) e.userData.hpBar.remove();
      scene.remove(e);
    });
    enemyBullets.forEach(b => scene.remove(b.mesh));
    enemies = []; enemyBullets = [];

    const config = WAVE_CONFIGS[(wave - 1) % WAVE_CONFIGS.length];
    config.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        let x, z;
        do {
          x = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
          z = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
        } while (Math.abs(x) < 5 && Math.abs(z) < 5);
        enemies.push(createEnemy(x, z, type));
      }
    });
  }

  function updateEnemies() {
    const pp = camera.position;
    enemies.forEach(enemy => {
      const pos  = enemy.position;
      const diff = new THREE.Vector3().subVectors(pp, pos);
      diff.y = 0;
      const dist = diff.length();
      const moving = dist > 2;

      if (moving) {
        diff.normalize();
        const s = enemy.userData.step;
        pos.x = Math.max(-ARENA_SIZE+1, Math.min(ARENA_SIZE-1, pos.x + diff.x * s));
        pos.z = Math.max(-ARENA_SIZE+1, Math.min(ARENA_SIZE-1, pos.z + diff.z * s));
        enemy.lookAt(pp.x, pos.y, pp.z);

        // Walk animation
        enemy.userData.walkTime += 0.13;
        const sw = Math.sin(enemy.userData.walkTime) * 0.32;
        if (enemy.userData.leftLegPivot)  enemy.userData.leftLegPivot.rotation.x  =  sw;
        if (enemy.userData.rightLegPivot) enemy.userData.rightLegPivot.rotation.x = -sw;
        if (enemy.userData.leftArmPivot)  enemy.userData.leftArmPivot.rotation.x  = -sw * 0.5;
        if (enemy.userData.rightArmPivot) enemy.userData.rightArmPivot.rotation.x =  sw * 0.5;
      } else {
        // idle sway
        enemy.userData.walkTime += 0.025;
        const idle = Math.sin(enemy.userData.walkTime) * 0.04;
        if (enemy.userData.leftArmPivot)  enemy.userData.leftArmPivot.rotation.x  = idle;
        if (enemy.userData.rightArmPivot) enemy.userData.rightArmPivot.rotation.x = -idle;
      }

      // Update floating HP bar
      updateEnemyHpBar(enemy);

      if (--enemy.userData.shootCooldown <= 0) {
        enemy.userData.shootCooldown = enemy.userData.shootCdMax;
        const dir  = new THREE.Vector3().subVectors(pp, pos).normalize();
        const from = pos.clone().add(dir.clone().multiplyScalar(1.2));
        from.y = 1.3;
        // bullet color matches enemy type
        const bColor = { grunt: 0xff3322, scout: 0x44ff88, tank: 0xff8800 }[enemy.userData.typeName] || 0xff3322;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: bColor })
        );
        mesh.position.copy(from);
        scene.add(mesh);
        enemyBullets.push({ mesh, velocity: dir.multiplyScalar(ENEMY_BULLET_SPEED), damage: enemy.userData.damage });
      }
    });
  }

  function updateEnemyHpBar(enemy) {
    const { hpBar, hpFill, health, maxHealth, hpBarOffset } = enemy.userData;
    if (!hpBar) return;
    const barPos = enemy.position.clone().add(new THREE.Vector3(0, hpBarOffset || 2.45, 0));
    vec3Proj.copy(barPos).project(camera);
    if (vec3Proj.z > 1 || vec3Proj.z < -1) { hpBar.style.display = 'none'; return; }
    hpBar.style.display = 'block';
    hpBar.style.left = ((vec3Proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    hpBar.style.top  = ((-vec3Proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    const pct = Math.max(0, health / maxHealth * 100);
    hpFill.style.width = pct + '%';
    const hue = pct * 1.2;
    hpFill.style.background = `hsl(${hue}, 90%, 48%)`;
  }

  function updateEnemyBullets(delta) {
    const pp = camera.position;
    const toRemove = [];
    enemyBullets.forEach((b, i) => {
      const step  = b.velocity.clone().multiplyScalar(delta * 60);
      const prevPos = b.mesh.position.clone();
      b.mesh.position.add(step);

      // Check if bullet passed through an obstacle
      if (obstacleObjects.length > 0) {
        bulletRaycaster.set(prevPos, b.velocity.clone().normalize());
        bulletRaycaster.far = step.length() + 0.2;
        const obsHits = bulletRaycaster.intersectObjects(obstacleObjects, false);
        if (obsHits.length > 0) {
          scene.remove(b.mesh);
          toRemove.push(i);
          return;
        }
      }

      if (b.mesh.position.distanceTo(pp) < 0.55) {
        playerHealth -= (b.damage || 8);
        updateHUD();
        scene.remove(b.mesh);
        toRemove.push(i);
        if (playerHealth <= 0) endGame(false);
      } else if (b.mesh.position.length() > ARENA_SIZE * 2) {
        scene.remove(b.mesh); toRemove.push(i);
      }
    });
    toRemove.reverse().forEach(i => enemyBullets.splice(i, 1));
  }

  // ─── Viewmodel ────────────────────────────────────────────────────────────
  function buildViewmodel() {
    if (viewmodel) camera.remove(viewmodel);
    viewmodel = new THREE.Group();

    const w          = WEAPONS[currentWeaponIdx];
    const skinMat    = new THREE.MeshStandardMaterial({ color: 0xd4a882, roughness: 0.8 });
    const sleeveMat  = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    const bodyMat    = new THREE.MeshStandardMaterial({ color: w.bodyColor, roughness: 0.45, metalness: 0.55 });
    const accentMat  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
    const gripMat    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });

    // ── Upper arm (sleeve, comes from right edge) ────
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.060, 0.22, 8), sleeveMat);
    upperArm.rotation.x = Math.PI / 2;
    upperArm.position.set(0.16, -0.06, -0.18);
    viewmodel.add(upperArm);

    // ── Elbow pad ────────────────────────────────────
    const elbowPad = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), sleeveMat);
    elbowPad.scale.set(1, 0.7, 1);
    elbowPad.position.set(0.15, -0.06, -0.30);
    viewmodel.add(elbowPad);

    // ── Forearm ───────────────────────────────────────
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.058, 0.22), skinMat);
    forearm.position.set(0.14, -0.04, -0.42);
    forearm.rotation.x = 0.10;
    viewmodel.add(forearm);
    // Forearm sleeve edge
    const sleeveEdge = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.063, 0.035), sleeveMat);
    sleeveEdge.position.set(0.14, -0.04, -0.31);
    viewmodel.add(sleeveEdge);
    // Wrist watch / band
    const watchBand = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.030, 0.040), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }));
    watchBand.position.set(0.14, -0.04, -0.51);
    viewmodel.add(watchBand);

    // ── Hand / palm ───────────────────────────────────
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.052, 0.072), skinMat);
    palm.position.set(0.14, -0.045, -0.575);
    viewmodel.add(palm);
    // Thumb bump
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), skinMat);
    thumb.position.set(0.105, -0.040, -0.560);
    viewmodel.add(thumb);
    // Knuckle row
    for (let f = 0; f < 3; f++) {
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), skinMat);
      knuckle.position.set(0.12 + f * 0.016, -0.026, -0.606);
      viewmodel.add(knuckle);
    }

    // ── Gun body ──────────────────────────────────────
    const isLauncher = w.key === 6, isSniper = w.key === 4,
          isShotgun  = w.key === 2, isSMG    = w.key === 5,
          isMinigun  = w.key === 8, isLaser  = w.key === 7;

    const bW = isLauncher ? 0.09 : isSniper ? 0.040 : 0.058;
    const bH = isLauncher ? 0.09 : 0.068;
    const bD = isShotgun  ? 0.11 : isSMG ? 0.09 : isSniper ? 0.20 : 0.14;

    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), bodyMat);
    gunBody.position.set(0.14, -0.020, -0.545);
    viewmodel.add(gunBody);

    // Grip / handle
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.095, 0.048), gripMat);
    grip.position.set(0.14, -0.090, -0.530);
    grip.rotation.x = 0.18;
    viewmodel.add(grip);
    // Trigger guard
    const tGuard = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.022, 0.052), accentMat);
    tGuard.position.set(0.14, -0.065, -0.530);
    viewmodel.add(tGuard);
    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.068, 0.036), gripMat);
    mag.position.set(0.14, -0.082, -0.548);
    viewmodel.add(mag);
    // Rail on top
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.55, 0.014, bD * 0.85), accentMat);
    rail.position.set(0.14, -0.020 + bH * 0.5 + 0.009, -0.545);
    viewmodel.add(rail);
    // Iron sight rear
    const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.022, 0.008), accentMat);
    sightR.position.set(0.14, -0.020 + bH * 0.5 + 0.022, -0.530);
    viewmodel.add(sightR);
    // Iron sight front
    const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.008), accentMat);
    sightF.position.set(0.14, -0.020 + bH * 0.5 + 0.022, -0.560);
    viewmodel.add(sightF);

    // ── Barrel ────────────────────────────────────────
    const barW   = isLauncher ? 0.055 : isMinigun ? 0.038 : 0.022;
    const barLen = w.barrelLen;
    const barZ   = -(0.545 + bD * 0.5 + barLen * 0.5);

    if (isMinigun) {
      // Four rotating barrels around a centre
      [[ 0.030,  0.030], [-0.030,  0.030],
       [ 0.030, -0.030], [-0.030, -0.030]].forEach(([ox, oy]) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, barLen, 6), accentMat);
        b.rotation.x = Math.PI / 2;
        b.position.set(0.14 + ox, -0.020 + oy, barZ);
        viewmodel.add(b);
      });
    } else {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barW * 0.5, barW * 0.5, barLen, isShotgun ? 8 : 6), accentMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0.14, -0.020, barZ);
      viewmodel.add(barrel);
      // Muzzle brake ring
      const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(barW * 0.7, barW * 0.6, 0.022, 6), accentMat);
      muzzleBrake.rotation.x = Math.PI / 2;
      muzzleBrake.position.set(0.14, -0.020, barZ - barLen * 0.5 + 0.011);
      viewmodel.add(muzzleBrake);
    }

    // ── Muzzle flash ──────────────────────────────────
    const muzzleZ = -(0.545 + bD * 0.5 + barLen + 0.04);
    muzzleFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.10),
      new THREE.MeshBasicMaterial({ color: 0xffbb44, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
    );
    muzzleFlash.position.set(0.14, -0.020, muzzleZ);
    muzzleFlash.rotation.x = -Math.PI / 2;
    muzzleFlash.visible = false;
    viewmodel.add(muzzleFlash);

    viewmodel.position.set(0.26, -0.20, -0.40);
    viewmodel.scale.setScalar(1.2);
    camera.add(viewmodel);
  }

  // ─── Weapon Wheel ─────────────────────────────────────────────────────────
  // ─── Inventory ────────────────────────────────────────────────────────────
  function selectSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= INVENTORY_SIZE) return;
    // Save ammo back to current slot
    if (playerInventory[currentSlot]) playerInventory[currentSlot].ammo = currentAmmo;
    currentSlot = slotIdx;
    const slot = playerInventory[currentSlot];
    if (slot) {
      currentWeaponIdx = slot.weaponIdx;
      currentAmmo      = slot.ammo;
      isReloading      = false;
      burstFiring      = false;
      spinupProgress   = 0;
      lastShotTime     = 0;
      if (reloadBarWrap) reloadBarWrap.style.display = 'none';
      updateSpinupHUD(null);
      buildViewmodel();
      const w = WEAPONS[slot.weaponIdx];
      if (weaponNameEl) {
        weaponNameEl.textContent = w.name;
        weaponPerkEl.textContent = w.perk;
        weaponDownEl.textContent = w.downside;
      }
    }
    updateInventoryHUD();
  }

  function pickupWeapon(weaponIdx) {
    // Save ammo for current slot
    if (playerInventory[currentSlot]) playerInventory[currentSlot].ammo = currentAmmo;
    // Prefer empty slot, otherwise replace current
    let target = playerInventory.indexOf(null);
    if (target === -1) target = currentSlot;
    playerInventory[target] = { weaponIdx, ammo: WEAPONS[weaponIdx].clipSize };
    // Auto-equip if we had nothing
    if (!playerInventory[currentSlot] || target === currentSlot) {
      currentSlot = target;
      selectSlot(currentSlot);
    }
    updateInventoryHUD();
    showPickupFlash(weaponIdx);
  }

  function showPickupFlash(weaponIdx) {
    const el = document.getElementById('pickup-flash');
    if (!el) return;
    const rarity = WEAPON_RARITY[weaponIdx] || 'common';
    el.textContent = `⬆ ${WEAPONS[weaponIdx].name}`;
    el.className = `pickup-flash rarity-${rarity}`;
    void el.offsetWidth;
    el.classList.add('pfx-anim');
  }

  function updateInventoryHUD() {
    const bar = document.getElementById('inv-bar');
    if (!bar) return;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const slotEl = bar.children[i];
      if (!slotEl) continue;
      const inv = playerInventory[i];
      slotEl.classList.toggle('active', i === currentSlot);
      if (!inv) {
        slotEl.dataset.rarity = '';
        slotEl.querySelector('.inv-icon').style.background = 'rgba(255,255,255,0.06)';
        slotEl.querySelector('.inv-name').textContent = '';
        slotEl.querySelector('.inv-ammo').textContent = '';
        slotEl.classList.remove('has-weapon');
      } else {
        const w = WEAPONS[inv.weaponIdx];
        const rarity = WEAPON_RARITY[inv.weaponIdx] || 'common';
        const rarHex = '#' + RARITY_COLORS[rarity].toString(16).padStart(6,'0');
        slotEl.dataset.rarity = rarity;
        slotEl.querySelector('.inv-icon').style.background = `#${w.bodyColor.toString(16).padStart(6,'0')}`;
        slotEl.querySelector('.inv-icon').style.boxShadow  = `0 0 12px ${rarHex}88`;
        slotEl.querySelector('.inv-name').textContent = w.name;
        const ammo = (i === currentSlot) ? currentAmmo : inv.ammo;
        slotEl.querySelector('.inv-ammo').textContent = `${ammo}/${w.clipSize}`;
        slotEl.classList.add('has-weapon');
      }
    }
  }

  // ─── Weapon Drops ─────────────────────────────────────────────────────────
  function spawnWeaponDrop(pos, weaponIdx) {
    const rarity  = WEAPON_RARITY[weaponIdx] || 'common';
    const rarColor = RARITY_COLORS[rarity];
    const dropMat = new THREE.MeshStandardMaterial({
      color: rarColor, emissive: new THREE.Color(rarColor), emissiveIntensity: 1.4,
      metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.92,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), dropMat);
    crystal.position.set(pos.x, 0.55, pos.z);
    scene.add(crystal);

    // Glow ring on ground
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.055, 6, 24),
      new THREE.MeshBasicMaterial({ color: rarColor, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos.x, 0.04, pos.z);
    scene.add(ring);

    // DOM label
    const label = document.createElement('div');
    label.className = `drop-label rarity-${rarity}`;
    label.innerHTML = `<span class="dl-name">${WEAPONS[weaponIdx].name}</span><span class="dl-rarity">${RARITY_LABELS[rarity]}</span>`;
    document.getElementById('damage-numbers').appendChild(label);

    weaponDrops.push({ crystal, ring, label, weaponIdx, spawnTime: Date.now() });
  }

  function updateWeaponDrops() {
    const now = Date.now();
    const toRemove = [];
    weaponDrops.forEach((drop, i) => {
      drop.crystal.rotation.y += 0.032;
      drop.crystal.position.y  = 0.55 + Math.sin(now * 0.0022 + i * 1.3) * 0.14;
      drop.ring.rotation.z    += 0.016;

      // Expire after 18s
      if (now - drop.spawnTime > 18000) { _cleanDrop(drop); toRemove.push(i); return; }

      // DOM label positioning
      const lblPos = drop.crystal.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      vec3Proj.copy(lblPos).project(camera);
      if (vec3Proj.z > 1 || !gameRunning) {
        drop.label.style.opacity = '0';
      } else {
        drop.label.style.opacity  = '1';
        drop.label.style.left = ((vec3Proj.x * 0.5 + 0.5) * window.innerWidth)  + 'px';
        drop.label.style.top  = ((-vec3Proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      }

      // Pickup on proximity
      if (gameRunning && camera.position.distanceTo(drop.crystal.position) < 1.4) {
        pickupWeapon(drop.weaponIdx);
        _cleanDrop(drop); toRemove.push(i);
      }
    });
    toRemove.reverse().forEach(i => weaponDrops.splice(i, 1));
  }

  function _cleanDrop(drop) {
    scene.remove(drop.crystal);
    scene.remove(drop.ring);
    drop.label.remove();
  }

  // ─── Wave Flow ────────────────────────────────────────────────────────────
  function nextWave() {
    // Clear any remaining orbs and drops
    healthOrbs.forEach(o => scene.remove(o.mesh));
    healthOrbs = [];
    weaponDrops.forEach(d => _cleanDrop(d));
    weaponDrops = [];

    // Wave complete bonus
    score += currentWave * 500;

    if (currentWave >= TOTAL_WAVES) {
      endGame(true);
      return;
    }

    currentWave++;
    showWaveAnnouncement(currentWave, () => {
      if (!gameRunning) return;
      spawnEnemies(currentWave);
      updateHUD();
    });
  }

  function showWaveAnnouncement(wave, callback) {
    const el = document.getElementById('wave-announce');
    if (!el) { if (callback) callback(); return; }

    const waveEl  = el.querySelector('#wa-wave');
    const titleEl = el.querySelector('#wa-title');
    const subEl   = el.querySelector('#wa-sub');

    const cfg     = WAVE_CONFIGS[(wave - 1) % WAVE_CONFIGS.length];
    const total   = cfg.reduce((s, g) => s + g.count, 0);
    const types   = cfg.map(g => `${g.count} ${ENEMY_TYPES[g.type].label}`).join(' · ');

    if (waveEl)  waveEl.textContent  = `WAVE ${wave} / ${TOTAL_WAVES}`;
    if (titleEl) titleEl.textContent = wave === 1 ? 'ENGAGE!' : wave === TOTAL_WAVES ? 'FINAL WAVE!' : 'WAVE CLEAR!';
    if (subEl)   subEl.textContent   = `${total} enemies — ${types}`;

    el.classList.add('visible');
    setTimeout(() => {
      el.classList.remove('visible');
      if (callback) callback();
    }, 2400);
  }

  // ─── Game Control ─────────────────────────────────────────────────────────
  function startGame() {
    startScreen.classList.add('hidden');
    gameOverEl.style.display = 'none';
    winScreen.style.display  = 'none';
    hudEl.classList.remove('hidden');
    document.getElementById('weapon-hud').classList.remove('hidden');

    document.body.classList.remove('show-cursor');
    camera.position.set(0, EYE_HEIGHT, 0);
    yaw = pitch = 0;
    playerVy = 0; playerGrounded = true;
    velocity.set(0, 0, 0);
    playerHealth   = PLAYER_HEALTH;
    kills          = 0;
    score          = 0;
    currentWave    = 1;
    gameRunning    = true;
    moveForward  = false;
    moveBackward = false;
    moveLeft     = false;
    moveRight    = false;
    mouseDown      = false;
    burstFiring    = false;
    spinupProgress = 0;
    lastShotTime   = 0;
    isReloading    = false;
    healthOrbs.forEach(o => scene.remove(o.mesh));
    healthOrbs = [];
    weaponDrops.forEach(d => _cleanDrop(d));
    weaponDrops = [];

    // Start with only a pistol — everything else is looted
    playerInventory = new Array(INVENTORY_SIZE).fill(null);
    playerInventory[0] = { weaponIdx: 0, ammo: WEAPONS[0].clipSize };
    currentSlot = 0;
    currentWeaponIdx = 0;
    currentAmmo = WEAPONS[0].clipSize;

    spawnEnemies(currentWave);
    damagePopups.forEach(p => p.el.remove());
    damagePopups = [];
    shootRecoil  = 0;

    selectSlot(0);
    muzzleFlash.visible    = false;
    viewmodel.position.z   = -0.45;

    updateHUD();
    showWaveAnnouncement(1, null);
    document.body.requestPointerLock();
  }

  function updateHUD() {
    const pct = Math.max(0, playerHealth / PLAYER_HEALTH * 100);
    healthFill.style.width = pct + '%';
    healthText.textContent = Math.round(playerHealth);
    if (scoreEl) scoreEl.textContent = score.toLocaleString();
    updateInventoryHUD();
    const waveEl = document.getElementById('hud-wave');
    if (waveEl) waveEl.textContent = `WAVE ${currentWave} / ${TOTAL_WAVES}`;
    const enemyEl = document.getElementById('hud-enemies');
    if (enemyEl) enemyEl.textContent = `${enemies.length} LEFT`;
  }

  function endGame(win) {
    gameRunning = false;
    document.exitPointerLock();
    document.body.classList.add('show-cursor');
    updateSpinupHUD(null);
    healthOrbs.forEach(o => scene.remove(o.mesh));
    healthOrbs = [];
    weaponDrops.forEach(d => _cleanDrop(d));
    weaponDrops = [];
    if (win) {
      winScreen.style.display = 'flex';
      document.getElementById('win-kills').textContent  = `Kills: ${kills}`;
      document.getElementById('win-score').textContent  = `Score: ${score.toLocaleString()}`;
    } else {
      gameOverEl.style.display = 'flex';
      document.getElementById('final-score').textContent = `Kills: ${kills}  ·  Wave ${currentWave}`;
      document.getElementById('final-score-pts').textContent = `Score: ${score.toLocaleString()}`;
    }
  }

  // ─── Shooting ─────────────────────────────────────────────────────────────
  function startReload() {
    if (isReloading) return;
    if (!playerInventory[currentSlot]) return;
    const w = WEAPONS[currentWeaponIdx];
    if (currentAmmo >= w.clipSize) return;
    isReloading     = true;
    reloadStartTime = Date.now();
    reloadBarWrap.style.display = 'block';
  }

  function updateReloadBar() {
    if (!isReloading) return;
    const w       = WEAPONS[currentWeaponIdx];
    const elapsed = Date.now() - reloadStartTime;
    const pct     = Math.min(elapsed / w.reloadMs, 1);
    reloadBarFill.style.width = (pct * 100) + '%';
    if (pct >= 1) {
      isReloading   = false;
      currentAmmo   = w.clipSize;
      reloadBarWrap.style.display = 'none';
      reloadBarFill.style.width   = '0%';
      updateAmmoHUD();
    }
  }

  function updateSpinupHUD(w) {
    const bar = document.getElementById('spinup-bar');
    if (!bar) return;
    if (!w || !w.spinup) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    const fill = document.getElementById('spinup-fill');
    if (fill) fill.style.width = Math.round(spinupProgress * 100) + '%';
    const lbl = document.getElementById('spinup-label');
    if (lbl) lbl.textContent = spinupProgress >= 0.99 ? 'FULL SPEED' : 'SPINNING UP';
  }

  function updateAmmoHUD() {
    // Keep ammo text (hidden weapon-hud) in sync
    if (ammoText) {
      const w = WEAPONS[currentWeaponIdx];
      ammoText.textContent = isReloading ? 'RELOADING...' : currentAmmo + ' / ' + w.clipSize;
    }
    // Sync current ammo to inventory slot and redraw bar
    if (playerInventory[currentSlot]) playerInventory[currentSlot].ammo = currentAmmo;
    updateInventoryHUD();
  }

  function tryShoot() {
    if (!gameRunning || !document.pointerLockElement) return;
    if (!playerInventory[currentSlot]) return; // no weapon in this slot
    const w   = WEAPONS[currentWeaponIdx];
    const now = Date.now();

    if (isReloading) return;
    if (currentAmmo <= 0) { startReload(); return; }
    if (burstFiring) return;
    // For spinup weapons: blend from 250ms down to full fire rate as spinupProgress → 1
    const effectiveRate = w.spinup
      ? w.fireRateMs + (250 - w.fireRateMs) * (1 - spinupProgress)
      : w.fireRateMs;
    if (now - lastShotTime < effectiveRate) return;

    lastShotTime = now;

    if (w.burst) {
      if (currentAmmo < w.burst) { startReload(); return; }
      burstFiring = true;
      fireBurst(w, 0);
      return;
    }

    executeShot(w);
  }

  function fireBurst(w, shotIdx) {
    if (shotIdx >= w.burst) { burstFiring = false; return; }
    if (shotIdx === 0) {
      executeShot(w);
      fireBurst(w, 1);
    } else {
      setTimeout(() => {
        if (!gameRunning) { burstFiring = false; return; }
        executeShot(w);
        fireBurst(w, shotIdx + 1);
      }, 80);
    }
  }

  function executeShot(w) {
    shootRecoil         = 1;
    muzzleFlash.visible = true;
    playGunshot(w.key);
    currentAmmo = Math.max(0, currentAmmo - 1);
    updateAmmoHUD();
    if (currentAmmo === 0) startReload();

    for (let p = 0; p < w.pellets; p++) {
      const ox = (Math.random() - 0.5) * w.spread * 2;
      const oy = (Math.random() - 0.5) * w.spread * 2;
      raycaster.setFromCamera(new THREE.Vector2(ox, oy), camera);
      // check obstacles first — bullet is blocked if an obstacle is closer than enemy
      const allTargets = [...enemies, ...obstacleObjects];
      const hits = raycaster.intersectObjects(allTargets, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        // If the first hit is an obstacle, bullet is blocked
        if (obstacleObjects.includes(obj)) continue;
        while (obj.parent && !enemies.includes(obj)) obj = obj.parent;
        if (enemies.includes(obj)) applyDamage(obj, w.damage, w.aoe);
      }
    }
  }

  function applyDamage(enemy, damage, aoe) {
    const pos   = enemy.position.clone();
    const toHit = [{ e: enemy, dmg: damage }];

    if (aoe > 0) {
      enemies.forEach(e => {
        if (e === enemy) return;
        const d = e.position.distanceTo(pos);
        if (d < aoe) toHit.push({ e, dmg: Math.max(1, Math.round(damage * (1 - d/aoe) * 0.75)) });
      });
    }

    toHit.forEach(({ e, dmg }) => {
      e.userData.health -= dmg;
      showDamagePopup(e.position.clone().add(new THREE.Vector3(0, 2.6, 0)), dmg);
    });
    if (toHit.length > 0) playHitSound();
    toHit.forEach(({ e }) => checkKill(e));
  }

  function checkKill(enemy) {
    if (!enemies.includes(enemy)) return;
    if (enemy.userData.health <= 0) {
      if (enemy.userData.hpBar) enemy.userData.hpBar.remove();
      const dropPos = enemy.position.clone();
      scene.remove(enemy);
      enemies = enemies.filter(e => e !== enemy);
      kills++;
      score += (enemy.userData.scoreValue || 100);
      updateHUD();
      // Always drop a weapon (quality depends on enemy type)
      const pool = LOOT_POOLS[enemy.userData.typeName] || LOOT_POOLS.grunt;
      spawnWeaponDrop(dropPos, pool[Math.floor(Math.random() * pool.length)]);
      // 25% chance to also drop a health orb
      if (Math.random() < 0.25) spawnHealthOrb(dropPos.clone().add(new THREE.Vector3(0.8, 0, 0.4)));
      if (enemies.length === 0) nextWave();
    }
  }

  // ─── Health Orbs ──────────────────────────────────────────────────────────
  function spawnHealthOrb(pos) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0x00ff88, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 1.8,
        transparent: true, opacity: 0.9,
      })
    );
    mesh.position.set(pos.x, 0.3, pos.z);
    scene.add(mesh);
    healthOrbs.push({ mesh, spawnTime: Date.now() });
  }

  function updateHealthOrbs() {
    const now = Date.now();
    const toRemove = [];
    healthOrbs.forEach((orb, i) => {
      // bob up/down
      orb.mesh.position.y = 0.3 + Math.sin((now * 0.003) + i) * 0.12;
      orb.mesh.rotation.y += 0.04;
      // auto-expire after 12 s
      if (now - orb.spawnTime > 12000) { scene.remove(orb.mesh); toRemove.push(i); return; }
      // player pickup
      if (camera.position.distanceTo(orb.mesh.position) < ORB_PICKUP_RADIUS) {
        const gained = Math.min(ORB_HEAL, PLAYER_HEALTH - playerHealth);
        if (gained > 0) {
          playerHealth += gained;
          showHealFlash();
          updateHUD();
        }
        scene.remove(orb.mesh);
        toRemove.push(i);
      }
    });
    toRemove.reverse().forEach(i => healthOrbs.splice(i, 1));
  }

  function showHealFlash() {
    const el = document.getElementById('heal-flash');
    if (!el) return;
    el.classList.remove('flash-active');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('flash-active');
  }

  // ─── Damage Popups ────────────────────────────────────────────────────────
  function showDamagePopup(worldPos, value) {
    if (value <= 0) return;
    const el = document.createElement('div');
    el.className = 'damage-popup';
    el.textContent = '-' + value;
    dmgContainer.appendChild(el);
    damagePopups.push({ el, worldPos: worldPos.clone(), startTime: Date.now() });
  }

  function updateDamagePopups() {
    const now = Date.now();
    const toRemove = [];
    damagePopups.forEach((pop, i) => {
      if (now - pop.startTime >= DAMAGE_POPUP_MS) {
        pop.el.remove();
        toRemove.push(i);
        return;
      }
      vec3Proj.copy(pop.worldPos).project(camera);
      if (vec3Proj.z > 1) { pop.el.style.opacity = '0'; return; }
      pop.el.style.left = ((vec3Proj.x  *  0.5 + 0.5) * window.innerWidth)  + 'px';
      pop.el.style.top  = ((-vec3Proj.y *  0.5 + 0.5) * window.innerHeight) + 'px';
    });
    toRemove.reverse().forEach(i => damagePopups.splice(i, 1));
  }

  // ─── Input ────────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW':    moveForward  = true; break;
      case 'KeyS':    moveBackward = true; break;
      case 'KeyA':    moveLeft     = true; break;
      case 'KeyD':    moveRight    = true; break;
      case 'Space':
        e.preventDefault();
        if (gameRunning && playerGrounded) {
          playerVy       = JUMP_FORCE;
          playerGrounded = false;
        }
        break;
      case 'KeyR':
        if (gameRunning) startReload();
        break;
    }
    const num = parseInt(e.key);
    if (num >= 1 && num <= INVENTORY_SIZE && gameRunning) selectSlot(num - 1);
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': moveForward  = false; break;
      case 'KeyS': moveBackward = false; break;
      case 'KeyA': moveLeft     = false; break;
      case 'KeyD': moveRight    = false; break;
    }
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      if (document.pointerLockElement === document.body) {
        tryShoot();
      } else if (gameRunning) {
        document.body.requestPointerLock();
      }
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }

  function onMouseMove(e) {
    if (!gameRunning || !document.pointerLockElement) return;
    const dx    = e.movementX;
    const dy    = e.movementY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    const accel = 1.0 + speed * 0.02;
    yaw   -= dx * BASE_SENSITIVITY * accel;
    pitch -= dy * BASE_SENSITIVITY * accel;
    pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  }

  // ─── Animation Loop ───────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (gameRunning && document.pointerLockElement === document.body) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      const w = WEAPONS[currentWeaponIdx];

      // Auto-fire
      if (mouseDown && w.auto) tryShoot();

      // Minigun spin-up / wind-down  (spinup = ramp time in seconds, progress 0→1)
      if (w.spinup) {
        spinupProgress = mouseDown
          ? Math.min(spinupProgress + delta / w.spinup, 1)
          : Math.max(0, spinupProgress - delta * 1.5);
        updateSpinupHUD(w);
      } else if (spinupProgress !== 0) {
        spinupProgress = 0;
        updateSpinupHUD(null);
      }

      // Recoil
      if (shootRecoil > 0) {
        shootRecoil = Math.max(0, shootRecoil - delta * 8);
        viewmodel.position.z = -0.45 + shootRecoil * w.recoilAmt * 1.4;
        if (shootRecoil < 0.9) muzzleFlash.visible = false;
      } else {
        viewmodel.position.z = -0.45;
      }

      // Horizontal movement
      direction.set(0, 0, 0);
      if (moveForward)  direction.z -= 1;
      if (moveBackward) direction.z += 1;
      if (moveLeft)     direction.x -= 1;
      if (moveRight)    direction.x += 1;
      if (direction.length() > 0) {
        direction.normalize().applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
        velocity.x = direction.x * PLAYER_SPEED;
        velocity.z = direction.z * PLAYER_SPEED;
      } else {
        velocity.x *= 0.85;
        velocity.z *= 0.85;
      }
      camera.position.x = Math.max(-ARENA_SIZE+1, Math.min(ARENA_SIZE-1, camera.position.x + velocity.x));
      camera.position.z = Math.max(-ARENA_SIZE+1, Math.min(ARENA_SIZE-1, camera.position.z + velocity.z));

      // Vertical / jump physics — detect ground or top surface of any obstacle
      playerVy -= GRAVITY * delta;
      camera.position.y += playerVy * delta;

      // Cast a ray straight down from the player's feet to find what they're standing on
      const feetY = camera.position.y - EYE_HEIGHT;
      downRay.ray.origin.set(camera.position.x, camera.position.y, camera.position.z);
      const downHits = downRay.intersectObjects(obstacleObjects, false);
      // Surface Y = top of whatever we're standing on (flat ground = 0)
      let surfaceY = 0;
      if (downHits.length > 0) {
        const hitY = downHits[0].point.y;
        if (hitY > -0.1) surfaceY = hitY; // ignore underground hits
      }
      const floorY = surfaceY + EYE_HEIGHT;

      if (camera.position.y <= floorY) {
        camera.position.y = floorY;
        playerVy       = 0;
        playerGrounded = true;
      } else if (playerVy < 0 && !downHits.length && feetY <= 0.05) {
        // flat ground fallback
        camera.position.y = EYE_HEIGHT;
        playerVy       = 0;
        playerGrounded = true;
      }

      updateEnemies();
      updateEnemyBullets(delta);
    }

    updateDamagePopups();
    if (gameRunning) { updateReloadBar(); updateHealthOrbs(); updateWeaponDrops(); }
    if (composer) { composer.render(); } else { renderer.render(scene, camera); }
  }

  init();
  animate();
})();
