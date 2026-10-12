(function (G) {
  'use strict';

  // Personajes con esqueleto: cuerpo redondeado (esferas y cilindros) unido en
  // una sola malla con huesos, así cada personaje es una sola llamada de dibujo.
  // El modelo mira hacia +Z. Su izquierda es +X.

  const U = G.Util;

  // Huesos: [nombre, padre, posición relativa al padre]
  const BONES = [
    ['hips', -1, [0, 0.95, 0]],
    ['spine', 0, [0, 0.18, 0]],
    ['chest', 1, [0, 0.2, 0]],
    ['neck', 2, [0, 0.2, 0]],
    ['head', 3, [0, 0.08, 0]],
    ['armL', 2, [0.19, 0.11, 0]], ['foreL', 5, [0, -0.28, 0]], ['handL', 6, [0, -0.25, 0]],
    ['armR', 2, [-0.19, 0.11, 0]], ['foreR', 8, [0, -0.28, 0]], ['handR', 9, [0, -0.25, 0]],
    ['legL', 0, [0.1, -0.06, 0]], ['shinL', 11, [0, -0.42, 0]], ['footL', 12, [0, -0.4, 0]],
    ['legR', 0, [-0.1, -0.06, 0]], ['shinR', 14, [0, -0.42, 0]], ['footR', 15, [0, -0.4, 0]]
  ];
  const BI = {};
  BONES.forEach((b, i) => { BI[b[0]] = i; });

  let matPlayer = null, matZombie = null, matWeapon = null;
  function mats() {
    if (!matPlayer) {
      matPlayer = new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true });
      matZombie = new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true });
      matWeapon = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
  }

  // ---------- Geometría del cuerpo ----------
  function bodyGeometry(o) {
    const m = new G.Mesher(true);
    const skin = o.skin, shirt = o.shirt, pants = o.pants, shoes = o.shoes || 0x2a2622;
    const sleeve = o.longSleeves ? shirt : skin;

    // pelvis y torso
    m.sphere(0, 0.93, 0, 0.165, 0.11, 0.115, pants, 1, BI.hips);
    m.cyl(0, 1.08, 0, 0.15, 0.155, 0.22, shirt, 10, BI.spine);
    m.sphere(0, 1.35, 0, 0.19, 0.15, 0.115, shirt, 2, BI.chest);
    m.cyl(0, 1.25, 0, 0.165, 0.185, 0.2, shirt, 12, BI.chest);
    // cuello y cabeza
    m.cyl(0, 1.52, 0, 0.05, 0.045, 0.1, skin, 8, BI.neck);
    m.sphere(0, 1.665, 0.005, 0.1, 0.122, 0.112, skin, 2, BI.head);
    m.sphere(0, 1.605, 0.02, 0.07, 0.045, 0.07, skin, 1, BI.head);          // mandíbula
    m.sphere(0, 1.66, 0.108, 0.012, 0.018, 0.012, U.shade(skin, 0.92), 1, BI.head); // nariz
    const eye = o.zombie ? 0xd8d4b8 : 0x1a1612;
    m.sphere(0.038, 1.69, 0.098, 0.016, 0.012, 0.01, eye, 1, BI.head);
    m.sphere(-0.038, 1.69, 0.098, 0.016, 0.012, 0.01, eye, 1, BI.head);
    if (o.zombie) m.sphere(0, 1.615, 0.1, 0.03, 0.012, 0.012, 0x3a1612, 1, BI.head);   // boca
    if (o.hair != null) {
      m.sphere(0, 1.71, -0.012, 0.108, 0.1, 0.118, o.hair, 2, BI.head);
      if (o.longHair) m.sphere(0, 1.6, -0.07, 0.1, 0.12, 0.06, o.hair, 1, BI.head);
    }
    // brazos
    for (const s of [1, -1]) {
      const A = s > 0 ? 'L' : 'R';
      const x = 0.19 * s;
      m.sphere(x - 0.01 * s, 1.415, 0, 0.056, 0.058, 0.056, shirt, 1, BI['arm' + A]);
      m.cyl(x + 0.004 * s, 1.29, 0, 0.046, 0.054, 0.26, shirt, 8, BI['arm' + A]);
      m.sphere(x, 1.16, 0, 0.046, 0.046, 0.046, sleeve, 1, BI['fore' + A]);
      m.cyl(x, 1.04, 0, 0.037, 0.045, 0.24, sleeve, 8, BI['fore' + A]);
      m.sphere(x, 0.86, 0.008, 0.036, 0.062, 0.026, skin, 1, BI['hand' + A]);
    }
    // piernas
    for (const s of [1, -1]) {
      const A = s > 0 ? 'L' : 'R';
      const x = 0.1 * s;
      m.cyl(x, 0.69, 0, 0.066, 0.085, 0.44, pants, 9, BI['leg' + A]);
      m.sphere(x, 0.48, 0.005, 0.062, 0.06, 0.062, pants, 1, BI['shin' + A]);
      m.cyl(x, 0.28, 0, 0.046, 0.06, 0.4, pants, 9, BI['shin' + A]);
      m.sphere(x, 0.06, 0.05, 0.055, 0.045, 0.12, shoes, 1, BI['foot' + A]);
    }
    // manchas de sangre en los zombis
    if (o.zombie && o.blood) {
      const r = o.blood;
      for (let i = 0; i < 4; i++) {
        const a = r() * 6.28, y = 1.05 + r() * 0.4;
        m.sphere(Math.sin(a) * 0.17, y, Math.cos(a) * 0.11, 0.06 + r() * 0.05, 0.05 + r() * 0.05, 0.02, 0x5a1a14, 1, y > 1.2 ? BI.chest : BI.spine);
      }
      m.sphere(0.02, 1.6, 0.085, 0.05, 0.03, 0.03, 0x5a1a14, 1, BI.head);
    }
    const g = m.build();
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
    return g;
  }

  // ---------- Personaje ----------
  function createHumanoid(o) {
    mats();
    const root = new THREE.Group();        // posición en el mundo y orientación
    const body = new THREE.Group();        // se inclina al caer
    root.add(body);

    const bones = BONES.map((b) => {
      const bone = new THREE.Bone();
      bone.name = b[0];
      bone.position.fromArray(b[2]);
      return bone;
    });
    BONES.forEach((b, i) => { if (b[1] >= 0) bones[b[1]].add(bones[i]); });

    const mesh = new THREE.SkinnedMesh(bodyGeometry(o), o.zombie ? matZombie : matPlayer);
    mesh.add(bones[0]);
    bones[0].updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);

    const rest = bones.map((b) => b.position.clone());
    const h = {
      root, body, mesh, bones, rest, zombie: !!o.zombie,
      weapon: null, weaponId: null
    };
    BONES.forEach((b, i) => { h[b[0]] = bones[i]; });
    return h;
  }

  function disposeHumanoid(h) {
    h.mesh.geometry.dispose();
    h.mesh.skeleton.dispose && h.mesh.skeleton.dispose();
  }

  // Coloca un arma en la mano derecha
  function setWeapon(h, id) {
    if (h.weaponId === id) return;
    if (h.weapon) { h.handR.remove(h.weapon); h.weapon = null; }
    h.weaponId = id;
    if (!id || id === 'manos') return;
    mats();
    const w = new THREE.Mesh(weaponGeometry(id), matWeapon);
    w.castShadow = true;
    const cat = G.Weapons.get(id).cat;
    // ángulo en la mano: la lanza apunta hacia abajo en reposo, el resto hacia delante y abajo
    w.rotation.x = cat === 'spear' ? Math.PI - 0.08 : 2.35;
    w.position.set(0, -0.05, 0.015);
    if (cat === 'spear') w.position.y = -0.05 - 0.5;   // se agarra por el medio
    h.handR.add(w);
    h.weapon = w;
  }

  // ---------- Poses y animación ----------
  function reset(h) {
    for (let i = 0; i < h.bones.length; i++) {
      h.bones[i].rotation.set(0, 0, 0);
      h.bones[i].position.copy(h.rest[i]);
    }
  }

  const sin = Math.sin, cos = Math.cos, max = Math.max;

  // Ciclo de caminar/correr. p = fase, a = intensidad (0 a 1)
  function legs(h, p, a, run, drag) {
    const amp = (run ? 0.85 : 0.55) * a;
    const ampL = amp * (drag ? 0.6 : 1);
    h.legL.rotation.x = -sin(p) * ampL;
    h.legR.rotation.x = sin(p) * amp;
    h.shinL.rotation.x = a * (0.1 + (run ? 1.3 : 0.75) * max(0, sin(p + 1.2))) * (drag ? 0.5 : 1);
    h.shinR.rotation.x = a * (0.1 + (run ? 1.3 : 0.75) * max(0, sin(p + 1.2 + Math.PI)));
    h.footL.rotation.x = -h.shinL.rotation.x * 0.3;
    h.footR.rotation.x = -h.shinR.rotation.x * 0.3;
    h.hips.position.y = 0.95 - 0.02 * a + Math.abs(sin(p)) * (run ? 0.06 : 0.03) * a;
    h.hips.rotation.y = sin(p) * 0.08 * a;
    h.chest.rotation.y = -sin(p) * 0.12 * a;
  }

  // Pose del jugador. s = { phase, amt, run, weapon (categoría), aim, action, t }
  function posePlayer(h, s) {
    reset(h);
    legs(h, s.phase, s.amt, s.run, false);
    const a = s.amt;
    const cat = s.cat;
    const two = s.hands === 2;
    // brazos al caminar
    h.armL.rotation.x = sin(s.phase) * (s.run ? 0.7 : 0.45) * a;
    h.armR.rotation.x = -sin(s.phase) * (s.run ? 0.7 : 0.45) * a;
    h.foreL.rotation.x = -0.25 - (s.run ? 0.9 : 0.1) * a;
    h.foreR.rotation.x = -0.25 - (s.run ? 0.9 : 0.1) * a;
    h.armL.rotation.z = 0.08; h.armR.rotation.z = -0.08;
    if (s.run) h.spine.rotation.x = 0.18;

    if (cat && cat !== 'none') {
      // sostener el arma: relajada al costado, o en guardia al apuntar
      if (s.aim) {
        h.armR.rotation.x = -0.75; h.armR.rotation.z = -0.15;
        h.foreR.rotation.x = -1.05;
        if (two) { h.armL.rotation.x = -0.8; h.armL.rotation.z = -0.5; h.foreL.rotation.x = -1.1; }
        h.spine.rotation.x = 0.1; h.chest.rotation.y = -0.15;
      } else {
        h.armR.rotation.x = -0.1 + (s.run ? -sin(s.phase) * 0.35 * a : -sin(s.phase) * 0.15 * a);
        h.foreR.rotation.x = -0.15 - (s.run ? 0.5 : 0) * a;
      }
    } else if (s.aim) {
      h.armL.rotation.x = -0.9; h.armR.rotation.x = -0.9;
      h.foreL.rotation.x = -0.9; h.foreR.rotation.x = -0.9;
    }

    if (s.action) action(h, s.action, s.t, two);
    if (s.climb != null) {
      const c = sin(Math.PI * s.climb);
      h.legL.rotation.x = -1.2 * c; h.shinL.rotation.x = 1.4 * c;
      h.legR.rotation.x = -0.4 * c; h.shinR.rotation.x = 0.8 * c;
      h.spine.rotation.x = 0.5 * c;
      h.armL.rotation.x = -1.0 * c; h.armR.rotation.x = -1.0 * c;
    }
  }

  // Ataques: t va de 0 a 1, el golpe ocurre hacia t = 0.45
  function action(h, kind, t, two) {
    const wind = U.smooth(t / 0.35);                 // preparación
    const hit = U.smooth((t - 0.3) / 0.25);          // golpe
    const back = U.smooth((t - 0.6) / 0.4);          // recuperación
    if (kind === 'swing2') {
      // golpe horizontal a dos manos: giro de cadera y torso
      const tw = -1.1 * wind + 2.0 * hit - 0.9 * back;
      h.spine.rotation.y = tw * 0.45;
      h.chest.rotation.y = tw * 0.55;
      h.armR.rotation.x = -1.25; h.armR.rotation.z = -0.25 + 0.2 * hit;
      h.foreR.rotation.x = -0.35;
      h.armL.rotation.x = -1.2; h.armL.rotation.z = -0.55;
      h.foreL.rotation.x = -0.5;
      h.legL.rotation.x += -0.25 * hit * (1 - back);
      h.legR.rotation.x += 0.2 * hit * (1 - back);
    } else if (kind === 'swing1' || kind === 'floor') {
      // golpe de arriba abajo a una mano (o al suelo)
      const low = kind === 'floor';
      const up = -2.7 * wind;
      const down = (low ? 2.2 : 1.6) * hit;
      h.armR.rotation.x = -0.4 + up + down + 0.6 * back;
      h.armR.rotation.z = -0.25 * wind;
      h.foreR.rotation.x = -0.9 * wind + 0.6 * hit;
      h.handR.rotation.x = 0.85 * hit * (1 - back * 0.6);   // la muñeca baja el arma al golpear
      h.spine.rotation.x = (low ? 0.55 : 0.12) * hit * (1 - back * 0.7);
      h.chest.rotation.y = -0.35 * wind + 0.6 * hit * (1 - back);
      if (two) { h.armL.rotation.x = h.armR.rotation.x; h.armL.rotation.z = -0.45; h.foreL.rotation.x = h.foreR.rotation.x - 0.3; }
      if (low) { h.legL.rotation.x = -0.5 * hit; h.shinL.rotation.x = 0.6 * hit; h.legR.rotation.x = 0.2 * hit; }
    } else if (kind === 'stab') {
      h.armR.rotation.x = -0.3 * (1 - hit) - 1.45 * hit * (1 - back) - 0.3 * back;
      h.foreR.rotation.x = -1.7 * wind * (1 - hit) - 0.15 * hit;
      h.handR.rotation.x = 0.75 * hit * (1 - back);
      h.chest.rotation.y = -0.3 * wind + 0.45 * hit * (1 - back);
      h.spine.rotation.x = 0.15 * hit * (1 - back);
    } else if (kind === 'thrust') {
      const f = hit * (1 - back);
      h.armR.rotation.x = -1.2 - 0.35 * f; h.armR.rotation.z = -0.1;
      h.foreR.rotation.x = -0.9 * (1 - f) - 0.1;
      h.armL.rotation.x = -1.1 - 0.4 * f; h.armL.rotation.z = -0.45;
      h.foreL.rotation.x = -0.9 * (1 - f) - 0.2;
      h.spine.rotation.x = 0.2 * f;
      h.legL.rotation.x = -0.5 * f; h.legR.rotation.x = 0.3 * f;
    } else if (kind === 'shove') {
      const f = hit * (1 - back);
      for (const A of ['L', 'R']) {
        h['arm' + A].rotation.x = -0.6 - 0.9 * f;
        h['arm' + A].rotation.z = A === 'L' ? -0.15 : 0.15;
        h['fore' + A].rotation.x = -1.3 * (1 - f) - 0.1;
      }
      h.spine.rotation.x = 0.25 * f;
      h.legL.rotation.x = -0.45 * f;
    } else if (kind === 'stomp') {
      const lift = wind * (1 - hit);
      h.legR.rotation.x = -1.2 * lift - 0.3 * hit * (1 - back);
      h.shinR.rotation.x = 1.3 * lift + 0.1;
      h.spine.rotation.x = 0.25 * (wind + hit) * (1 - back);
      h.armL.rotation.z = 0.5 * wind; h.armR.rotation.z = -0.5 * wind;
    }
  }

  // Pose del zombi. s = { phase, amt, chase, reach (0-1), stagger (0-1), bang, drag, sway }
  function poseZombie(h, s) {
    reset(h);
    legs(h, s.phase, s.amt, false, s.drag);
    const sw = sin(s.phase * 0.5 + s.seed);
    h.spine.rotation.z = sw * 0.06 + s.lean;
    h.neck.rotation.z = 0.25 * s.tilt + sw * 0.05;
    h.head.rotation.x = 0.2;
    h.spine.rotation.x = 0.12;
    // brazos: colgando al vagar, hacia delante al perseguir
    const up = s.chase ? 1 : s.armsUp;
    h.armL.rotation.x = -0.15 - 1.15 * up + sw * 0.15;
    h.armR.rotation.x = -0.15 - 1.05 * up - sw * 0.15;
    h.armL.rotation.z = 0.12; h.armR.rotation.z = -0.12;
    h.foreL.rotation.x = -0.25 - 0.2 * up;
    h.foreR.rotation.x = -0.3 - 0.2 * up;
    if (s.reach > 0) {
      const r = s.reach;
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.55, r);
      h.armR.rotation.x = U.lerp(h.armR.rotation.x, -1.5, r);
      h.armL.rotation.z = -0.15 * r; h.armR.rotation.z = 0.15 * r;
      h.foreL.rotation.x = -0.1; h.foreR.rotation.x = -0.1;
      h.spine.rotation.x = 0.12 + 0.35 * r;
      h.head.rotation.x = 0.35 * r;
    }
    if (s.bang) {
      const b = Math.max(0, sin(s.bang * 9));
      h.armL.rotation.x = -1.4 - 0.4 * b; h.armR.rotation.x = -1.4 - 0.4 * max(0, sin(s.bang * 9 + 1.5));
      h.spine.rotation.x = 0.25;
    }
    if (s.stagger > 0) {
      const k = sin(Math.PI * Math.min(1, s.stagger));
      h.spine.rotation.x = -0.45 * k;
      h.armL.rotation.z = 0.9 * k; h.armR.rotation.z = -0.9 * k;
      h.armL.rotation.x = -0.6 * k; h.armR.rotation.x = -0.6 * k;
      h.head.rotation.x = -0.3 * k;
    }
  }

  // Tumbado: f de 0 (de pie) a 1 (en el suelo). dir = -1 de espaldas, 1 boca abajo
  function poseFall(h, f, dir) {
    const a = dir * Math.PI / 2 * U.smooth(f);
    h.body.rotation.x = a;
    h.body.position.y = 0.12 * U.smooth(f);
    h.body.position.z = -dir * 0.0;
    if (f > 0.5) {
      h.armL.rotation.z = 0.6; h.armR.rotation.z = -0.5;
      h.armL.rotation.x = dir > 0 ? -0.2 : 0.3; h.armR.rotation.x = dir > 0 ? -0.3 : 0.2;
      h.legL.rotation.z = 0.12; h.legR.rotation.z = -0.1;
      h.head.rotation.y = 0.4;
    }
  }

  // ---------- Armas (modelos) ----------
  const geoCache = {};
  function weaponGeometry(id) {
    if (geoCache[id]) return geoCache[id];
    const m = new G.Mesher();
    const WOOD = 0x9a7046, DARKW = 0x6e4e30, METAL = 0x9aa0a6, DARKM = 0x55595e, RED = 0xa8322a, BLACK = 0x26262a, RUST = 0x7a5a3e;
    const nails = (y0, y1, r) => { for (let y = y0; y <= y1; y += 0.07) { m.box(0, y, 0, r * 2 + 0.07, 0.008, 0.008, DARKM); m.box(0, y + 0.035, 0, 0.008, 0.008, r * 2 + 0.07, DARKM); } };
    switch (id) {
      case 'bate': case 'bate_clavos':
        m.cyl(0, 0.2, 0, 0.018, 0.022, 0.4, WOOD, 8);
        m.cyl(0, 0.62, 0, 0.022, 0.036, 0.46, WOOD, 8);
        m.sphere(0, 0.85, 0, 0.036, 0.02, 0.036, WOOD, 1);
        m.cyl(0, 0.02, 0, 0.026, 0.026, 0.03, DARKW, 8);
        if (id === 'bate_clavos') nails(0.55, 0.82, 0.032);
        break;
      case 'golf':
        m.cyl(0, 0.12, 0, 0.016, 0.016, 0.24, BLACK, 8);
        m.cyl(0, 0.6, 0, 0.007, 0.01, 0.76, METAL, 6);
        m.box(0, 0.98, 0.04, 0.03, 0.05, 0.11, DARKM);
        break;
      case 'mazo':
        m.cyl(0, 0.38, 0, 0.018, 0.02, 0.76, WOOD, 8);
        m.box(0, 0.8, 0, 0.09, 0.09, 0.24, DARKM);
        break;
      case 'pala':
        m.cyl(0, 0.45, 0, 0.017, 0.017, 0.9, WOOD, 8);
        m.box(0, 0.04, 0, 0.1, 0.03, 0.03, BLACK);
        m.box(0, 1.0, 0, 0.22, 0.26, 0.012, DARKM);
        break;
      case 'tabla': case 'tabla_clavos':
        m.box(0, 0.5, 0, 0.09, 1.0, 0.025, 0xa98a62);
        if (id === 'tabla_clavos') for (let y = 0.65; y < 0.98; y += 0.08) m.box(0, y, 0, 0.12, 0.008, 0.008, DARKM);
        break;
      case 'palanca':
        m.cyl(0, 0.36, 0, 0.012, 0.012, 0.72, 0x3e3e42, 6);
        m.box(0, 0.73, 0.03, 0.02, 0.02, 0.07, 0x3e3e42, 0, 0, 0.5);
        break;
      case 'martillo':
        m.cyl(0, 0.16, 0, 0.014, 0.017, 0.32, WOOD, 8);
        m.box(0, 0.33, 0.01, 0.03, 0.03, 0.13, DARKM);
        break;
      case 'llave':
        m.box(0, 0.16, 0, 0.026, 0.32, 0.012, METAL);
        m.box(0, 0.34, 0, 0.06, 0.04, 0.02, METAL);
        break;
      case 'sarten':
        m.cyl(0, 0.1, 0, 0.012, 0.014, 0.2, BLACK, 8);
        m.cyl(0, 0.33, 0, 0.12, 0.13, 0.025, 0x3a3a3e, 14, 0, Math.PI / 2, 0, 0);
        break;
      case 'tubo':
        m.cyl(0, 0.31, 0, 0.018, 0.018, 0.62, 0x6c7176, 8);
        break;
      case 'rodillo':
        m.cyl(0, 0.04, 0, 0.012, 0.012, 0.08, WOOD, 6);
        m.cyl(0, 0.22, 0, 0.03, 0.03, 0.28, 0xc9a77c, 10);
        m.cyl(0, 0.4, 0, 0.012, 0.012, 0.08, WOOD, 6);
        break;
      case 'porra':
        m.cyl(0, 0.3, 0, 0.016, 0.019, 0.6, BLACK, 8);
        m.cyl(0, 0.14, 0.04, 0.012, 0.012, 0.09, BLACK, 6, 0, Math.PI / 2, 0, 0);
        break;
      case 'hacha_bombero':
        m.cyl(0, 0.44, 0, 0.018, 0.02, 0.88, RED, 8);
        m.box(0, 0.84, 0.07, 0.022, 0.14, 0.13, METAL);
        m.box(0, 0.84, -0.07, 0.02, 0.05, 0.12, DARKM);
        break;
      case 'hacha_mano':
        m.cyl(0, 0.2, 0, 0.015, 0.018, 0.42, WOOD, 8);
        m.box(0, 0.4, 0.05, 0.02, 0.09, 0.1, METAL);
        break;
      case 'machete':
        m.cyl(0, 0.07, 0, 0.016, 0.016, 0.14, BLACK, 8);
        m.box(0, 0.4, 0.008, 0.006, 0.52, 0.05, METAL);
        break;
      case 'katana':
        m.cyl(0, 0.13, 0, 0.016, 0.016, 0.26, BLACK, 8);
        m.cyl(0, 0.27, 0, 0.04, 0.04, 0.012, 0xb59a52, 10);
        m.box(0, 0.64, 0.004, 0.005, 0.72, 0.03, 0xc4c9ce);
        break;
      case 'cuchillo':
        m.box(0, 0.06, 0, 0.022, 0.12, 0.016, BLACK);
        m.box(0, 0.2, 0.006, 0.004, 0.17, 0.035, METAL);
        break;
      case 'cuchillo_caza':
        m.box(0, 0.06, 0, 0.026, 0.12, 0.02, DARKW);
        m.box(0, 0.125, 0, 0.05, 0.012, 0.02, DARKM);
        m.box(0, 0.22, 0.006, 0.005, 0.18, 0.04, METAL);
        break;
      case 'destornillador':
        m.cyl(0, 0.05, 0, 0.016, 0.02, 0.1, 0xd0a42a, 8);
        m.cyl(0, 0.18, 0, 0.004, 0.004, 0.16, METAL, 6);
        break;
      case 'cuchilla':
        m.box(0, 0.06, 0, 0.024, 0.12, 0.018, DARKW);
        m.box(0, 0.22, 0.025, 0.005, 0.2, 0.09, METAL);
        break;
      case 'lanza':
        m.cyl(0, 0.75, 0, 0.016, 0.018, 1.5, WOOD, 8);
        m.box(0, 1.52, 0, 0.026, 0.04, 0.026, 0x6b6b6b);
        m.cone(0, 1.62, 0, 0.022, 0.18, METAL, 4);
        break;
      default:
        m.cyl(0, 0.3, 0, 0.02, 0.02, 0.6, RUST, 6);
    }
    return (geoCache[id] = m.build());
  }

  G.Models = {
    createHumanoid, disposeHumanoid, setWeapon,
    posePlayer, poseZombie, poseFall, reset,
    weaponGeometry, BI
  };
})(window.Game = window.Game || {});
