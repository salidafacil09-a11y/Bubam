(function (G) {
  'use strict';

  const U = G.Util;
  const WALK = 2.1, RUN = 4.2, AIM_WALK = 1.25;
  const RADIUS = 0.28;
  const NOISE_RUN = 7;            // los zombis te oyen correr a esta distancia
  const MAX_CARRY = 3;            // armas que puedes llevar

  class Player {
    constructor(scene) {
      this.model = G.Models.createHumanoid({
        skin: 0xd6a57e, shirt: 0x3d6a74, pants: 0x34405a, hair: 0x3a2a1c, shoes: 0x3b3029, longSleeves: true
      });
      scene.add(this.model.root);
      this.reset();
    }

    reset() {
      const s = G.World.SPAWN;
      this.pos = { x: s.x, z: s.z };
      this.y = G.World.groundY(s.x, s.z);
      this.facing = Math.PI;
      this.health = 100;
      this.stamina = 1;
      this.noise = 0;
      this.noiseLevel = 0;
      this.hurt = 0;
      this.phase = 0;
      this.moveAmt = 0;
      this.running = false;
      this.aiming = false;
      this.action = null;        // { kind, t, dur, ... }
      this.climb = null;
      this.weapons = [];         // [{ id, cond }]
      this.cur = -1;             // -1 = manos
      this.bleed = 0;            // segundos de sangrado restantes
      this.bleedRate = 0;
      this.infected = false;
      this.infectTime = 0;
      this.sick = false;
      this.wounds = 0;
      this.dead = false;
      this.deathCause = '';
      this.downedTime = 0;
      this.model.root.visible = true;
      this.model.body.rotation.set(0, 0, 0);
      this.model.body.position.set(0, 0, 0);
      G.Models.setWeapon(this.model, null);
      this.apply();
    }

    get weapon() {
      return this.cur >= 0 ? G.Weapons.get(this.weapons[this.cur].id) : G.Weapons.FISTS;
    }
    get slot() { return this.cur >= 0 ? this.weapons[this.cur] : null; }

    busy() { return !!(this.action || this.climb); }

    // ---------- Armas ----------
    equip(i) {
      this.cur = i;
      G.Models.setWeapon(this.model, i >= 0 ? this.weapons[i].id : null);
    }

    cycleWeapon() {
      if (this.busy()) return null;
      if (!this.weapons.length) return null;
      const n = this.weapons.length;
      const next = this.cur + 1 >= n ? -1 : this.cur + 1;
      this.equip(next);
      return this.weapon.name;
    }

    // Devuelve el arma que soltó (si había que hacer sitio)
    pickUp(id, cond) {
      let dropped = null;
      if (this.weapons.length >= MAX_CARRY) {
        const i = this.cur >= 0 ? this.cur : 0;
        dropped = this.weapons[i];
        this.weapons.splice(i, 1);
      }
      this.weapons.push({ id, cond });
      this.equip(this.weapons.length - 1);
      return dropped;
    }

    breakCurrent() {
      if (this.cur < 0) return;
      this.weapons.splice(this.cur, 1);
      this.equip(-1);
    }

    // ---------- Daño ----------
    damage(amount) {
      this.health = Math.max(0, this.health - amount);
      this.hurt = 0.4;
    }

    wound(type) {
      this.wounds++;
      if (type === 'rasguño') { this.damage(4); if (Math.random() < 0.07) this.infect(); }
      else if (type === 'laceración') { this.damage(9); this.bleed = Math.max(this.bleed, 12); this.bleedRate = Math.max(this.bleedRate, 0.45); if (Math.random() < 0.25) this.infect(); }
      else { this.damage(14); this.bleed = Math.max(this.bleed, 20); this.bleedRate = Math.max(this.bleedRate, 0.75); this.infect(); }
    }

    infect() {
      if (!this.infected) { this.infected = true; this.infectTime = 0; }
    }

    // ---------- Actualización ----------
    update(dt, input, cam) {
      if (this.dead) return;
      const f = cam.forward(), r = cam.right();
      const mx = input.move.x, my = input.move.y;
      const mag = Math.min(1, Math.hypot(mx, my));
      let moving = mag > 0.12 && !this.climb;

      this.aiming = !!input.aim && !this.climb;
      const canRun = this.stamina > 0.04 && !this.aiming && !this.action;
      this.running = moving && input.run && canRun;

      // dirección en el mundo relativa a la cámara
      let wx = f.x * -my + r.x * mx;
      let wz = f.z * -my + r.z * mx;
      const wl = Math.hypot(wx, wz) || 1;
      wx /= wl; wz /= wl;

      let speed = this.running ? RUN : (this.aiming ? AIM_WALK : WALK);
      if (this.action) speed *= this.action.kind === 'stomp' || this.action.kind === 'floor' ? 0.1 : 0.35;
      speed *= mag;

      if (this.climb) {
        this.updateClimb(dt);
      } else if (moving) {
        G.World.move(this.pos, wx * speed * dt, wz * speed * dt, RADIUS);
      }

      // orientación: hacia la cámara al apuntar o atacar, si no hacia donde caminas
      const camYaw = Math.atan2(f.x, f.z);
      if (this.climb) {
        // la fija updateClimb
      } else if (this.aiming || this.action) {
        this.facing = U.turnToward(this.facing, this.action && this.action.face != null ? this.action.face : camYaw, 14 * dt);
      } else if (moving) {
        this.facing = U.turnToward(this.facing, Math.atan2(wx, wz), 10 * dt);
      }

      // resistencia
      if (this.running) this.stamina = Math.max(0, this.stamina - 0.07 * dt);
      else if (!this.action) this.stamina = Math.min(1, this.stamina + (moving ? 0.06 : 0.11) * dt);

      // ruido
      if (this.running) { this.noise = NOISE_RUN; this.noiseLevel = 2; }
      else if (moving) { this.noise = 0; this.noiseLevel = 1; }
      else { this.noise = 0; this.noiseLevel = 0; }

      // heridas
      if (this.bleed > 0) {
        this.bleed -= dt;
        this.damage(this.bleedRate * dt);
        this.hurt = Math.max(this.hurt, 0.05);
        if (this.bleed <= 0) this.bleedRate = 0;
      } else if (!this.infected && this.health < 100) {
        this.health = Math.min(100, this.health + 0.25 * dt);
      }
      if (this.infected) {
        this.infectTime += dt;
        if (this.infectTime > 300) { this.sick = true; this.health -= 0.16 * dt; }
      }
      this.hurt = Math.max(0, this.hurt - dt);

      const target = moving ? mag : 0;
      this.moveAmt += (target - this.moveAmt) * Math.min(1, dt * 10);
      this.phase += dt * (this.running ? 10.5 : (this.aiming ? 6 : 7.5)) * (this.moveAmt > 0.05 ? 1 : 0);
      this.y += (G.World.groundY(this.pos.x, this.pos.z) - this.y) * Math.min(1, dt * 12);
      if (this.health <= 0 && !this.dead) this.die(this.sick ? 'La infección acabó contigo.' : 'Te desangraste.');
    }

    // Saltar por una ventana abierta o una valla
    startClimb(ref, kind) {
      const W = G.World;
      const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x;
      const mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
      const nx = ref.o === 'N' ? 0 : 1, nz = ref.o === 'N' ? 1 : 0;
      const side = (this.pos.x - mx) * nx + (this.pos.z - mz) * nz > 0 ? 1 : -1;
      const tx = mx - nx * side * 0.6, tz = mz - nz * side * 0.6;
      if (W.circleBlocked(tx, tz, RADIUS)) return false;
      this.climb = {
        x0: this.pos.x, z0: this.pos.z, x1: tx, z1: tz, t: 0,
        dur: kind === 'fence' ? 0.9 : 1.3, h: kind === 'fence' ? 0.7 : 0.95,
        face: Math.atan2(-nx * side, -nz * side)
      };
      this.action = null;
      return true;
    }

    updateClimb(dt) {
      const c = this.climb;
      c.t += dt / c.dur;
      const t = Math.min(1, c.t);
      this.pos.x = U.lerp(c.x0, c.x1, U.smooth(t));
      this.pos.z = U.lerp(c.z0, c.z1, U.smooth(t));
      this.facing = U.turnToward(this.facing, c.face, 12 * dt);
      this.climbLift = Math.sin(Math.PI * t) * c.h;
      if (c.t >= 1) { this.climb = null; this.climbLift = 0; }
    }

    die(cause) {
      this.dead = true;
      this.deathCause = cause;
      this.deathT = 0;
      this.action = null;
      this.climb = null;
    }

    // Pose y posición del modelo
    apply(dt) {
      const m = this.model;
      m.root.position.set(this.pos.x, this.y + (this.climbLift || 0), this.pos.z);
      m.root.rotation.y = this.facing;
      if (this.dead) {
        this.deathT = Math.min(1, (this.deathT || 0) + (dt || 0) * 1.6);
        G.Models.poseZombie(m, { phase: 0, amt: 0, chase: false, armsUp: 0, reach: 0, stagger: 0, seed: 0, lean: 0, tilt: 0 });
        G.Models.poseFall(m, this.deathT, 1);
        return;
      }
      const w = this.weapon;
      const a = this.action;
      G.Models.posePlayer(m, {
        phase: this.phase, amt: this.moveAmt, run: this.running,
        cat: w.cat, hands: w.hands, aim: this.aiming || !!a,
        action: a ? a.kind : null, t: a ? Math.min(1, a.t) : 0,
        climb: this.climb ? Math.min(1, this.climb.t) : null
      });
    }
  }

  G.Player = Player;
})(window.Game = window.Game || {});
