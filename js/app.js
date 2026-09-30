(() => {
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp = (a,b,t) => a + (b-a)*t;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ---------- Renderizador e cena ---------- */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#161c28');
scene.fog = new THREE.Fog('#161c28', 26, 48);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight('#e4ecff', '#5d4c3c', 0.62));
const sun = new THREE.DirectionalLight('#fff1dc', 1.15);
sun.position.set(6, 13, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left:-13, right:13, top:10, bottom:-10, near:1, far:40});
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
const back = new THREE.DirectionalLight('#bcd8ff', 0.35); back.position.set(0, 6, -12); scene.add(back);

const matCache = {};
function mat(color, rough=0.8, metal=0, extra={}){
  const k = color+rough+metal+JSON.stringify(extra);
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial(Object.assign({color, roughness:rough, metalness:metal}, extra)));
}
function add(geo, m, parent, x=0, y=0, z=0, cast=true){
  const o = new THREE.Mesh(geo, m); o.position.set(x,y,z);
  o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o;
}
const box = (w,h,d,m,p,x,y,z,c) => add(new THREE.BoxGeometry(w,h,d), m, p, x,y,z,c);
const cyl = (rt,rb,h,m,p,x,y,z,seg=18) => add(new THREE.CylinderGeometry(rt,rb,h,seg), m, p, x,y,z);
function canvasTex(w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  t.userData = {c, ctx}; return t;
}

/* ---------- Sala ---------- */
const W = 20, D = 14;
const floorTex = canvasTex(512, 512, (g, w, h) => {
  const rows = 8, ph = h/rows;
  for (let r=0; r<rows; r++){
    let x = (r%2) * -90;
    while (x < w){
      const len = 150 + Math.random()*120, l = 52 + Math.random()*8;
      g.fillStyle = `hsl(${28+Math.random()*6},${32+Math.random()*8}%,${l}%)`;
      g.fillRect(x, r*ph, len, ph);
      g.fillStyle = 'rgba(60,35,15,.35)'; g.fillRect(x, r*ph, 2, ph);
      for (let i=0;i<5;i++){ g.fillStyle='rgba(90,55,25,.08)'; g.fillRect(x, r*ph + Math.random()*ph, len, 1); }
      x += len;
    }
    g.fillStyle = 'rgba(50,30,12,.45)'; g.fillRect(0, r*ph, w, 2);
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 3);
const floor = add(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({map:floorTex, roughness:.62}), scene, 0,0,0, false);
floor.rotation.x = -Math.PI/2;
// tapete central
const rugTex = canvasTex(512, 320, (g, w, h) => {
  g.fillStyle = '#34435a'; g.fillRect(0,0,w,h);
  g.strokeStyle = '#c9a15a'; g.lineWidth = 6; g.strokeRect(18,18,w-36,h-36);
  g.strokeStyle = 'rgba(201,161,90,.4)'; g.lineWidth = 2; g.strokeRect(34,34,w-68,h-68);
  for (let i=0;i<9000;i++){ g.fillStyle=`rgba(255,255,255,${Math.random()*.03})`; g.fillRect(Math.random()*w,Math.random()*h,2,2); }
});
const rug = add(new THREE.PlaneGeometry(7, 4.2), new THREE.MeshStandardMaterial({map:rugTex, roughness:1}), scene, 0, 0.005, -0.4, false);
rug.rotation.x = -Math.PI/2;

const wallH = 3.2, walls = [];
function wall(w, x, z, ry, color){
  const m = new THREE.MeshStandardMaterial({color, roughness:.92, transparent:true, opacity:1});
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  box(w, wallH, 0.2, m, g, 0, wallH/2, 0);
  const base = new THREE.MeshStandardMaterial({color:'#5b4a3c', roughness:.7, transparent:true});
  box(w, 0.14, 0.24, base, g, 0, 0.07, 0.03);
  walls.push({g, mats:[m, base], op:1}); return g;
}
const wBack = wall(W+0.2, 0, -D/2-0.1, 0, '#cfd8d3');
const wFront = wall(W+0.2, 0, D/2+0.1, Math.PI, '#cfd8d3');
const wLeft = wall(D+0.2, -W/2-0.1, 0, Math.PI/2, '#bfcbc6');
const wRight = wall(D+0.2, W/2+0.1, 0, -Math.PI/2, '#bfcbc6');
walls[0].test = p => p.z < -D/2 + 0.2; walls[1].test = p => p.z > D/2 - 0.2;
walls[2].test = p => p.x < -W/2 + 0.2; walls[3].test = p => p.x > W/2 - 0.2;
function wallItem(g, obj){ g.add(obj); obj.traverse(o => { if (o.isMesh){ o.material = o.material.clone(); o.material.transparent = true; walls.find(w=>w.g===g).mats.push(o.material);} }); return obj; }

// janelas no fundo
[-6.8, 0, 6.8].forEach(x => {
  const j = new THREE.Group(); j.position.set(x, 1.85, 0.12);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.35), new THREE.MeshStandardMaterial({color:'#cfe6ff', emissive:'#9cc7f0', emissiveIntensity:.75, roughness:.2}));
  j.add(glass);
  const fm = mat('#f3f1ec', .5);
  [[2.45,.08,0,.72],[2.45,.08,0,-.72],[.08,1.5,-1.2,0],[.08,1.5,1.2,0],[.05,1.4,0,0],[2.3,.04,0,0]].forEach(([w,h,xx,yy]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w,h,.08), fm); b.position.set(xx,yy,.02); j.add(b); });
  const sill = new THREE.Mesh(new THREE.BoxGeometry(2.6,.06,.22), fm); sill.position.set(0,-.78,.08); j.add(sill);
  wallItem(wBack, j);
});
// relógio na parede do fundo
const clock = new THREE.Group(); clock.position.set(3.4, 2.45, 0.13);
{
  const face = new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.05,40), mat('#f7f5f0',.4)); face.rotation.x = Math.PI/2; clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.32,.03,10,40), mat('#2a2f38',.4,.3)); clock.add(rim);
  for (let i=0;i<12;i++){ const t = new THREE.Mesh(new THREE.BoxGeometry(.02, i%3?.04:.07, .01), mat('#2a2f38')); const a=i/12*Math.PI*2; t.position.set(Math.sin(a)*.26, Math.cos(a)*.26, .03); t.rotation.z=-a; clock.add(t); }
  const mk = (len, w, c) => { const p = new THREE.Group(); const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, .01), mat(c)); h.position.y = len/2 - .03; p.add(h); p.position.z = .04; clock.add(p); return p; };
  clock.userData = {h: mk(.16,.03,'#1f2430'), m: mk(.24,.02,'#1f2430'), s: mk(.26,.008,'#c0392b')};
  wallItem(wBack, clock);
}
// quadro branco na parede direita
const boardTex = canvasTex(640, 400, ()=>{});
{
  const b = new THREE.Group(); b.position.set(-4.3, 1.75, 0.13);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, .05), mat('#9aa3ad', .4, .5)); b.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), new THREE.MeshStandardMaterial({map:boardTex, roughness:.35})); face.position.z = .03; b.add(face);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(2.2,.04,.1), mat('#9aa3ad',.4,.5)); tray.position.set(0,-.82,.06); b.add(tray);
  wallItem(wRight, b);
}
// painel de métricas na parede esquerda (TV)
const tvTex = canvasTex(512, 288, ()=>{});
{
  const t = new THREE.Group(); t.position.set(-0.9, 1.9, 0.14);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.22, .06), mat('#15181e', .3, .4)); t.add(body);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.12), new THREE.MeshBasicMaterial({map:tvTex, toneMapped:false})); sc.position.z = .035; t.add(sc);
  wallItem(wLeft, t);
}
// quadros decorativos
function artTex(seed){
  return canvasTex(256, 320, (g,w,h) => {
    const pal = [['#e8e1d3','#c96f4a','#2f4858','#e2b44d'],['#dfe6e2','#3d6b5e','#d9a441','#8a4f3d']][seed];
    g.fillStyle = pal[0]; g.fillRect(0,0,w,h);
    g.fillStyle = pal[1]; g.beginPath(); g.arc(w*.38, h*.4, 70, 0, 7); g.fill();
    g.fillStyle = pal[2]; g.fillRect(w*.45, h*.45, 110, 130);
    g.fillStyle = pal[3]; g.fillRect(40, h*.72, 120, 22);
  });
}
[[wFront, 3.2, 0], [wFront, 5.2, 1]].forEach(([wg, x, s]) => {
  const g = new THREE.Group(); g.position.set(x, 1.8, .13);
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.25, .04), mat('#2b2f36',.5)); g.add(f);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.88,1.12), new THREE.MeshStandardMaterial({map:artTex(s), roughness:.8})); p.position.z = .025; g.add(p);
  wallItem(wg, g);
});
// porta na frente
{
  const g = new THREE.Group(); g.position.set(-4, 0, .12);
  const fr = mat('#f3f1ec', .5);
  [[.1,2.3,-.6,1.15],[.1,2.3,.6,1.15],[1.3,.1,0,2.3]].forEach(([w,h,x,y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w,h,.1), fr); b.position.set(x,y,0); g.add(b); });
  const d = new THREE.Mesh(new THREE.BoxGeometry(1.1,2.22,.05), mat('#7a5a3f',.6)); d.position.set(0,1.11,-.01); g.add(d);
  const k = new THREE.Mesh(new THREE.SphereGeometry(.04,10,8), mat('#c9a15a',.3,.8)); k.position.set(.4,1.05,.04); g.add(k);
  wallItem(wFront, g);
}

/* ---------- Colisões ---------- */
const obstacles = [];
function obstacleRect(cx, cz, ry, x0, x1, z0, z1){
  const c = Math.cos(ry), s = Math.sin(ry);
  let minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
  [[x0,z0],[x1,z0],[x0,z1],[x1,z1]].forEach(([x,z]) => {
    const wx = cx + x*c + z*s, wz = cz - x*s + z*c;
    minx=Math.min(minx,wx); maxx=Math.max(maxx,wx); minz=Math.min(minz,wz); maxz=Math.max(maxz,wz);
  });
  obstacles.push({minx,maxx,minz,maxz});
}

/* ---------- Decoração ---------- */
function plant(x, z, s=1){
  const g = new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s); scene.add(g);
  cyl(.24,.18,.5, mat('#d9d2c5',.7), g, 0,.25,0);
  cyl(.22,.22,.03, mat('#3b2a1e',1), g, 0,.49,0);
  const leaf = mat('#3f7a4f', .75), leaf2 = mat('#5a9a5f', .75);
  for (let i=0;i<9;i++){
    const l = new THREE.Mesh(new THREE.SphereGeometry(.19, 8, 6), i%2?leaf:leaf2);
    const a = i*2.4, r = .1 + (i%3)*.07;
    l.position.set(Math.cos(a)*r, .75 + i*.07, Math.sin(a)*r); l.scale.set(1, 1.35, .6); l.rotation.y = a;
    l.castShadow = true; g.add(l);
  }
  g.userData.sway = Math.random()*6; plants.push(g);
  obstacleRect(x, z, 0, -.3*s, .3*s, -.3*s, .3*s);
}
const plants = [];
plant(-9.2, -6.2, 1.2); plant(9.2, -6.2, 1.2); plant(9.2, 6.2, 1.1); plant(-9.2, 6.2, .95);
plant(-1.9, -6.3, 1.05); plant(1.9, -6.3, 1.05); plant(6.2, 6.3, .8);

function shelf(x, z, ry){
  const g = new THREE.Group(); g.position.set(x,0,z); g.rotation.y = ry; scene.add(g);
  const wood = mat('#6d4f37', .7);
  box(1.9,.05,.4, wood, g, 0,.02,0); box(1.9,.05,.4, wood, g, 0,2.0,0);
  box(.05,2,.4, wood, g, -.93,1,0); box(.05,2,.4, wood, g, .93,1,0); box(1.9,2,.03, mat('#5a4230',.8), g, 0,1,-.19);
  const cols = ['#b5543c','#2f5d7c','#d9a441','#3d6b5e','#e8e1d3','#6a5aa3','#3a3f4a'];
  [.45,.95,1.45].forEach((y,ri) => {
    box(1.84,.04,.38, wood, g, 0,y,0);
    let xx = -.86;
    while (xx < .8){
      const w = .05 + Math.random()*.05, h = .3 + Math.random()*.12;
      if (Math.random() < .12){ xx += .12; continue; }
      box(w, h, .26, mat(cols[(Math.random()*cols.length)|0], .8), g, xx + w/2, y + .02 + h/2, 0);
      xx += w + .005;
    }
  });
  const vase = cyl(.08,.06,.22, mat('#e9e4da',.4), g, .5, 2.14, 0);
  obstacleRect(x, z, ry, -1, 1, -.25, .25);
}
shelf(-9.7, -4.4, Math.PI/2);
shelf(9.7, 1.1, -Math.PI/2);

// sala de estar (frente-direita)
{
  const g = new THREE.Group(); g.position.set(9.1, 0, 4.3); g.rotation.y = -Math.PI/2; scene.add(g);
  const fab = mat('#4a5a6e', .95);
  box(2.4,.42,.9, fab, g, 0,.29,0); box(2.4,.62,.22, fab, g, 0,.72,-.36);
  box(.2,.55,.9, fab, g, -1.2,.45,0); box(.2,.55,.9, fab, g, 1.2,.45,0);
  box(.55,.3,.18, mat('#c9a15a',.9), g, -.6,.66,-.18).rotation.x = -.2;
  obstacleRect(9.1, 4.3, -Math.PI/2, -1.35, 1.35, -.5, .5);
  const t = new THREE.Group(); t.position.set(7.6, 0, 4.3); scene.add(t);
  box(.7,.05,1.2, mat('#6d4f37',.5), t, 0,.42,0);
  [[-.3,-.55],[.3,-.55],[-.3,.55],[.3,.55]].forEach(([a,b]) => box(.04,.4,.04, mat('#2b2f36',.4,.6), t, a,.2,b));
  cyl(.05,.04,.1, mat('#f2efe8',.4), t, .1,.5,.2); box(.25,.03,.32, mat('#b5543c',.7), t, -.1,.46,-.25);
  obstacleRect(7.6, 4.3, 0, -.4, .4, -.65, .65);
}
// bebedouro
{
  const g = new THREE.Group(); g.position.set(-9.3, 0, 5.2); scene.add(g);
  box(.4,1.0,.4, mat('#e7e9ec',.4), g, 0,.5,0);
  cyl(.15,.15,.42, new THREE.MeshStandardMaterial({color:'#9fd0f5', transparent:true, opacity:.65, roughness:.1}), g, 0,1.22,0);
  obstacleRect(-9.3, 5.2, 0, -.25,.25,-.25,.25);
}
// luminárias de chão
function lamp(x, z){
  const g = new THREE.Group(); g.position.set(x,0,z); scene.add(g);
  cyl(.18,.2,.04, mat('#2b2f36',.4,.6), g, 0,.02,0);
  cyl(.02,.02,1.7, mat('#2b2f36',.4,.6), g, 0,.86,0);
  const shade = cyl(.18,.26,.3, mat('#efe6d2',.9,0,{emissive:'#ffd79a', emissiveIntensity:.55}), g, 0,1.75,0);
  shade.castShadow = false;
  const L = new THREE.PointLight('#ffcf8a', .55, 6, 2); L.position.set(0,1.6,0); g.add(L);
  obstacleRect(x, z, 0, -.22,.22,-.22,.22);
}
lamp(-9.3, -2.2); lamp(9.3, -2.6);

/* ---------- Personagens ---------- */
function makeCharacter(look){
  const root = new THREE.Group();
  const skin = mat(look.skin, .7), shirt = mat(look.shirt, .85), pants = mat(look.pants, .85);
  const hair = mat(look.hair, .9), shoe = mat('#1d1f24', .6);
  const hips = new THREE.Group(); hips.position.y = .92; root.add(hips);
  cyl(.17,.16,.16, pants, hips, 0, .02, 0).scale.z = .7;
  const legs = [-1,1].map(side => {
    const thigh = new THREE.Group(); thigh.position.set(side*.1, 0, 0); hips.add(thigh);
    cyl(.078,.068,.46, pants, thigh, 0,-.23,0, 12);
    const knee = new THREE.Group(); knee.position.y = -.45; thigh.add(knee);
    cyl(.066,.056,.42, pants, knee, 0,-.21,0, 12);
    box(.12,.08,.25, shoe, knee, 0,-.44,.05);
    return {thigh, knee};
  });
  const upper = new THREE.Group(); upper.position.y = .06; hips.add(upper);
  const torso = cyl(.205,.165,.54, shirt, upper, 0,.28,0, 20); torso.scale.z = .66;
  if (look.tie) box(.06,.3,.02, mat(look.tie,.5), upper, 0,.34,.14);
  if (look.jacket){ const j = cyl(.215,.175,.5, mat(look.jacket,.8), upper, 0,.28,-.012, 20); j.scale.z = .62; torso.material = mat('#eef0f2',.8); }
  cyl(.05,.055,.1, skin, upper, 0,.6,0, 10);
  const head = new THREE.Group(); head.position.y = .7; upper.add(head);
  const hd = add(new THREE.SphereGeometry(.14, 20, 16), skin, head, 0,.05,0); hd.scale.set(.95,1.1,1);
  const eye = mat('#22252c', .4);
  [-.048,.048].forEach(x => add(new THREE.SphereGeometry(.017, 8, 6), eye, head, x,.07,.128, false));
  add(new THREE.SphereGeometry(.022, 8, 6), skin, head, 0,.03,.14, false);
  const hTop = add(new THREE.SphereGeometry(.152, 20, 12, 0, Math.PI*2, 0, Math.PI*.5), hair, head, 0,.07,-.012);
  hTop.scale.set(1,1.05,1.05);
  if (look.hairStyle === 'long'){ const h = add(new THREE.CylinderGeometry(.15,.17,.36,16,1,true,Math.PI*.55,Math.PI*1.9), hair, head, 0,-.06,-.01); h.material = mat(look.hair,.9,0,{side:THREE.DoubleSide}); }
  if (look.hairStyle === 'bun') add(new THREE.SphereGeometry(.08, 12, 10), hair, head, 0,.2,-.1);
  if (look.glasses){ const gm = mat('#1b1d22',.3,.6); [-.05,.05].forEach(x => { const r = add(new THREE.TorusGeometry(.035,.007,6,16), gm, head, x,.075,.135, false); }); box(.04,.007,.007, gm, head, 0,.075,.14); }
  const arms = [-1,1].map(side => {
    const sh = new THREE.Group(); sh.position.set(side*.245, .5, 0); upper.add(sh);
    cyl(.058,.05,.31, shirt === torso.material ? shirt : mat(look.jacket || look.shirt, .85), sh, 0,-.15,0, 12);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    cyl(.047,.04,.26, skin, el, 0,-.13,0, 12);
    add(new THREE.SphereGeometry(.052, 10, 8), skin, el, 0,-.29,0);
    return {sh, el, side};
  });
  const anchor = new THREE.Object3D(); anchor.position.y = 2.02; root.add(anchor);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return {root, hips, upper, head, legs, arms, anchor, phase:0, walk:0, t:Math.random()*10};
}
function poseStanding(c, dt, speed, turning){
  c.t += dt;
  const target = clamp(Math.max(Math.abs(speed)/3.2, turning ? .45 : 0), 0, 1);
  c.walk = lerp(c.walk, target, 1 - Math.exp(-dt*10));
  c.phase += dt * (Math.abs(speed) > .05 ? speed : (turning ? 2.2 : 0)) * 3.1;
  const w = c.walk, s = Math.sin(c.phase), co = Math.cos(c.phase);
  c.legs[0].thigh.rotation.x = -s * .6 * w;
  c.legs[1].thigh.rotation.x =  s * .6 * w;
  c.legs[0].knee.rotation.x = w * (.1 + .75 * Math.max(0, co));
  c.legs[1].knee.rotation.x = w * (.1 + .75 * Math.max(0, -co));
  const breathe = Math.sin(c.t*2.1);
  c.arms[0].sh.rotation.x =  s * .5 * w + breathe*.02*(1-w);
  c.arms[1].sh.rotation.x = -s * .5 * w - breathe*.02*(1-w);
  c.arms.forEach(a => { a.sh.rotation.z = a.side * (.07 + .02*(1-w)); a.el.rotation.x = -.18 - .3*w; });
  c.hips.position.y = .92 + Math.abs(Math.cos(c.phase)) * .045 * w - .02*w;
  c.upper.rotation.y = s * .07 * w;
  c.upper.rotation.x = .05 * w + breathe*.008;
  c.upper.scale.y = 1 + breathe*.006*(1-w);
  c.head.rotation.y = lerp(c.head.rotation.y, 0, dt*3);
}
function poseSeated(c, dt, mode, look){
  c.t += dt;
  const k = 1 - Math.exp(-dt*6);
  c.legs.forEach(l => { l.thigh.rotation.x = -Math.PI/2 + .05; l.knee.rotation.x = Math.PI/2 - .1; });
  c.hips.position.y = .92;
  let shx, elx, lean, headX = 0, headY = look ?? 0;
  if (mode === 'trab'){
    shx = -.95; elx = -.55; lean = .1; headX = .12 + Math.sin(c.t*.9)*.03;
    c.arms.forEach((a,i) => { a.sh.rotation.x = lerp(a.sh.rotation.x, shx + Math.sin(c.t*17 + i*1.7)*.05, k*2); a.el.rotation.x = lerp(a.el.rotation.x, elx + Math.cos(c.t*19 + i)*.06, k*2); a.sh.rotation.z = a.side*.28; });
    if (look == null) headY = Math.sin(c.t*.6)*.12;
  } else if (mode === 'coord'){
    const talk = Math.sin(c.t*1.3) > .2;
    lean = .04; headX = .02;
    c.arms.forEach((a,i) => {
      const tx = i === 1 && talk ? -1.2 + Math.sin(c.t*3)*.15 : -.9 + Math.sin(c.t*15 + i)*.04;
      a.sh.rotation.x = lerp(a.sh.rotation.x, tx, k); a.el.rotation.x = lerp(a.el.rotation.x, i===1&&talk ? -.9 : -.55, k); a.sh.rotation.z = a.side*.25;
    });
    if (look == null) headY = Math.sin(c.t*.5)*.35;
  } else {
    lean = -.12; headX = -.03;
    c.arms.forEach(a => { a.sh.rotation.x = lerp(a.sh.rotation.x, -.35, k); a.el.rotation.x = lerp(a.el.rotation.x, -1.0, k); a.sh.rotation.z = a.side*.2; });
    if (look == null) headY = Math.sin(c.t*.35) * .6;
  }
  c.upper.rotation.x = lerp(c.upper.rotation.x, lean, k);
  c.upper.scale.y = 1 + Math.sin(c.t*2)*.006;
  c.head.rotation.x = lerp(c.head.rotation.x, headX, k);
  c.head.rotation.y = lerp(c.head.rotation.y, headY, k);
}

/* ---------- Mesas e agentes ---------- */
const AGENTS = [
  {id:'gerente', emoji:'👨‍💼', name:'Marcos', role:'Gerente de Marketing', tagRole:'Gerente', pos:[0,-4.1], ry:Math.PI, big:true, screen:'dash',
   look:{skin:'#c68b6e', shirt:'#eef0f2', jacket:'#2d3950', pants:'#23262d', hair:'#2b2320', tie:'#b8862b'}},
  {id:'pesquisador', emoji:'🔎', name:'Lívia', role:'Pesquisadora', pos:[-7.4,-0.9], ry:-Math.PI/2, screen:'search',
   look:{skin:'#e0b196', shirt:'#4f7a6a', pants:'#3a3f4a', hair:'#6b3d22', hairStyle:'long'}},
  {id:'copywriter', emoji:'✍️', name:'Rafael', role:'Copywriter', pos:[-7.4,2.9], ry:-Math.PI/2, screen:'text',
   look:{skin:'#8d5a42', shirt:'#a8563f', pants:'#2f3440', hair:'#1e1a18', glasses:true}},
  {id:'criativo', emoji:'🎬', name:'Bia', role:'Criativa (design e vídeo)', pos:[-4.6,-4.6], ry:Math.PI, screen:'grid',
   look:{skin:'#f0c6a8', shirt:'#6a5aa3', pants:'#2a2d35', hair:'#b36a33', hairStyle:'bun'}},
  {id:'analista', emoji:'📊', name:'Otávio', role:'Analista de Dados', pos:[5.4,-4.6], ry:Math.PI, screen:'chart',
   look:{skin:'#d19c7c', shirt:'#3c6f96', pants:'#30343d', hair:'#3a3a3a', glasses:true}},
  {id:'social', emoji:'📱', name:'Carol', role:'Social Media', pos:[7.4,-0.9], ry:Math.PI/2, screen:'feed',
   look:{skin:'#a86f52', shirt:'#b4546e', pants:'#2c2f37', hair:'#231a17', hairStyle:'long'}},
  {id:'secretaria', emoji:'🗂️', name:'Helena', role:'Secretária do Gerente', tagRole:'Secretária', pos:[2.8,-4.6], ry:Math.PI, screen:'kanban', secretary:true,
   look:{skin:'#e6b89c', shirt:'#f3ece6', jacket:'#7d2f3e', pants:'#2b2227', hair:'#3b2418', hairStyle:'bun'}},
];
const agentMeshes = [];
function makeScreen(type){
  const tex = canvasTex(256, 160, ()=>{});
  tex.userData.type = type; tex.userData.acc = 0; return tex;
}
function drawScreen(tex, t, busy){
  const {ctx:g, c} = tex.userData, w = c.width, h = c.height, type = tex.userData.type;
  g.fillStyle = busy ? '#0f1726' : '#0b0f18'; g.fillRect(0,0,w,h);
  g.fillStyle = '#1d2a40'; g.fillRect(0,0,w,14);
  ['#e06c5a','#e2b44d','#5ccf95'].forEach((cl,i)=>{ g.fillStyle = cl; g.beginPath(); g.arc(8+i*9,7,2.6,0,7); g.fill(); });
  if (!busy){
    g.fillStyle = 'rgba(242,182,74,.5)'; g.font = '600 15px sans-serif';
    const x = 40 + Math.sin(t*.4)*30, y = 80 + Math.cos(t*.3)*25;
    g.fillText('em espera', x, y); tex.needsUpdate = true; return;
  }
  const F = (a,b,cl,x,y) => { g.fillStyle = cl; g.fillRect(x,y,a,b); };
  if (type === 'text'){
    const n = Math.floor(t*3) % 14;
    for (let i=0;i<Math.min(n,11);i++) F(40 + ((i*53)%150), 5, i===0?'#e2b44d':'#9fb0c8', 14, 24 + i*11);
    if (Math.floor(t*2)%2) F(3, 9, '#fff', 14 + 40 + ((n*53)%150), 22 + Math.min(n,11)*11);
  } else if (type === 'chart'){
    for (let i=0;i<9;i++){ const v = 30 + 70*Math.abs(Math.sin(i*1.3 + t*.8)); F(18, v, i%3? '#3c7fb8':'#e2b44d', 16+i*25, 150-v); }
    g.strokeStyle = '#5ccf95'; g.lineWidth = 2; g.beginPath();
    for (let i=0;i<=12;i++){ const y = 70 - 25*Math.sin(i*.6 + t); i?g.lineTo(i*20+10,y):g.moveTo(10,y); } g.stroke();
  } else if (type === 'grid'){
    const cols = ['#b5543c','#6a5aa3','#e2b44d','#3d6b5e','#2f5d7c','#c96f4a'];
    for (let i=0;i<6;i++){ const sel = Math.floor(t*1.2)%6 === i; F(70, 58, cols[(i+Math.floor(t*.5))%6], 12 + (i%3)*80, 22 + Math.floor(i/3)*68); if (sel){ g.strokeStyle='#fff'; g.lineWidth=2; g.strokeRect(12+(i%3)*80, 22+Math.floor(i/3)*68, 70, 58);} }
  } else if (type === 'search'){
    F(200, 16, '#2a3a55', 28, 24); F(90*((t*.5)%1), 5, '#e2b44d', 34, 30);
    for (let i=0;i<5;i++){ F(120 + (i*37)%70, 6, '#8fb3ff', 28, 54 + i*20); F(170, 4, '#56657d', 28, 63 + i*20); }
  } else if (type === 'feed'){
    for (let i=0;i<3;i++){ const y = ((i*55 - t*18) % 165 + 165) % 165 - 10; F(90, 48, '#1f2c44', 83, y+14); F(90, 30, ['#b4546e','#e2b44d','#3d6b5e'][i], 83, y+14); F(50, 4, '#cfd6e1', 88, y+50); }
  } else {
    ['A fazer','Fazendo','Feito'].forEach((_,col) => { F(74, 130, '#16223a', 10 + col*82, 22); for (let i=0;i<3;i++){ const on = (Math.floor(t*.7)+i+col)%4; if (on) F(64, 18, ['#2f5d7c','#e2b44d','#3d6b5e'][col], 15 + col*82, 30 + i*26); } });
  }
  tex.needsUpdate = true;
}
function buildDesk(a){
  const g = new THREE.Group(); g.position.set(a.pos[0], 0, a.pos[1]); g.rotation.y = a.ry; scene.add(g);
  const w = a.big ? 2.5 : 1.6, d = a.big ? 1.05 : .8;
  const top = mat(a.big ? '#4a3527' : '#9c7a58', .45), leg = mat('#2b2f36', .35, .6);
  box(w, .05, d, top, g, 0, .76, 0);
  if (a.big){ box(w-.1, .66, .04, mat('#3b2a1e',.6), g, 0, .41, -d/2+.05); box(.05,.72,d-.1, leg, g, -w/2+.08,.37,0); box(.05,.72,d-.1, leg, g, w/2-.08,.37,0); }
  else [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => box(.05,.74,.05, leg, g, sx*(w/2-.06), .37, sz*(d/2-.06)));
  // monitor(es)
  const screens = [];
  const monX = a.big ? [-.42, .42] : [0];
  monX.forEach((mx, i) => {
    const m = new THREE.Group(); m.position.set(mx, .78, -.18); if (a.big) m.rotation.y = i ? -.18 : .18; g.add(m);
    box(.18,.02,.14, leg, m, 0,.01,0); box(.04,.24,.04, leg, m, 0,.14,-.02);
    box(.66,.4,.035, mat('#15181e',.3,.4), m, 0,.44,0);
    const tex = makeScreen(i ? 'chart' : a.screen);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(.62,.36), new THREE.MeshBasicMaterial({map:tex, toneMapped:false}));
    sc.position.set(0,.44,.019); m.add(sc); screens.push(tex);
  });
  box(.44,.02,.14, mat('#2a2e36',.5), g, 0,.79,.16);
  box(.07,.02,.11, mat('#2a2e36',.5), g, .34,.79,.18);
  cyl(.04,.035,.1, mat(['#e8e1d3','#b5543c','#2f5d7c'][a.id.length%3],.5), g, -w/2+.25,.83,.05);
  if (a.big){
    // luminária e placa
    const lp = new THREE.Group(); lp.position.set(-1.0,.78,-.3); g.add(lp);
    cyl(.07,.08,.02, leg, lp, 0,.01,0); box(.02,.4,.02, leg, lp, 0,.2,0);
    const sh = cyl(.03,.09,.1, mat('#b8862b',.4,.5,{emissive:'#ffcf8a',emissiveIntensity:.3}), lp, 0,.4,.05);
    box(.36,.08,.06, mat('#b8862b',.3,.7), g, .75,.82,.42);
    box(.5,.02,.32, mat('#f4f1ea',.9), g, .7,.785,-.05);
  } else {
    box(.22,.015,.3, mat('#f4f1ea',.9), g, -.45,.78,-.05);
  }
  if (a.secretary){
    // telefone, bandeja de papéis e placa de identificação
    box(.2,.05,.16, mat('#1f2329',.5), g, .55,.8,-.02);
    const fone = box(.2,.035,.05, mat('#2b2f36',.4), g, .55,.845,-.06); fone.rotation.z = .05;
    box(.3,.06,.24, mat('#8a6a4c',.6), g, -.5,.81,-.18);
    box(.26,.012,.2, mat('#f7f4ee',.9), g, -.5,.845,-.18);
    box(.4,.09,.05, mat('#7d2f3e',.4,.2), g, .1,.82,.38);
  }
  // cadeira
  const ch = new THREE.Group(); ch.position.set(0,0,.88); g.add(ch);
  const cm = mat(a.big ? '#1f2329' : '#2e3440', .7);
  box(.52,.08,.5, cm, ch, 0,.46,0);
  box(.5, a.big ? .75 : .55, .08, cm, ch, 0, a.big ? .86 : .78, .26);
  cyl(.03,.03,.36, leg, ch, 0,.25,0, 8);
  for (let i=0;i<5;i++){ const b = box(.3,.03,.04, leg, ch, 0,.05,0); b.rotation.y = i/5*Math.PI*2; b.position.set(Math.cos(i/5*Math.PI*2)*-.0, .05, 0); b.geometry.translate(.15,0,0); }
  // agente
  const c = makeCharacter(a.look);
  c.root.position.set(0, .55 - .92, .88); c.root.rotation.y = Math.PI; g.add(c.root);
  c.root.traverse(o => { if (o.isMesh){ o.userData.agentId = a.id; agentMeshes.push(o); } });
  // colisão (mesa + cadeira + agente)
  obstacleRect(a.pos[0], a.pos[1], a.ry, -w/2-.05, w/2+.05, -d/2-.05, 1.28);
  Object.assign(a, {group:g, char:c, screens, state:'disp'});
}
AGENTS.forEach(buildDesk);
const byId = Object.fromEntries(AGENTS.map(a => [a.id, a]));

/* ---------- Estante / Arquivo do escritório (parede da frente) ---------- */
const ARCH = {id:'arquivo', emoji:'📁', name:'Estante / Arquivo', role:'Arquivo do escritório', isArchive:true};
{
  const g = new THREE.Group(); g.position.set(0, 0, 6.62); g.rotation.y = Math.PI; scene.add(g);
  ARCH.group = g; ARCH.meshes = [];
  const walnut = new THREE.MeshStandardMaterial({color:'#5a3f2c', roughness:.55, transparent:true});
  const dark = new THREE.MeshStandardMaterial({color:'#3a2a1f', roughness:.7, transparent:true});
  const metal = new THREE.MeshStandardMaterial({color:'#8e969f', roughness:.35, metalness:.6, transparent:true});
  const fadeMats = [walnut, dark, metal];
  const W2 = 3.4, H2 = 1.95, Dp = .5;
  const B = (w,h,d,m,x,y,z) => { const o = box(w,h,d,m,g,x,y,z); ARCH.meshes.push(o); return o; };
  // corpo
  B(W2,.06,Dp, walnut, 0,H2,0); B(W2,.08,Dp, dark, 0,.04,0);
  B(.06,H2,Dp, walnut, -W2/2+.03,H2/2,0); B(.06,H2,Dp, walnut, W2/2-.03,H2/2,0);
  B(W2,H2,.03, dark, 0,H2/2,-Dp/2+.015);
  B(.05,H2,Dp, walnut, -.35,H2/2,0);
  // gavetas (lado esquerdo) — rótulos desenhados com os números reais
  const drawerTex = canvasTex(256, 512, ()=>{});
  ARCH.drawerTex = drawerTex;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 1.8), new THREE.MeshStandardMaterial({map:drawerTex, roughness:.5, transparent:true}));
  face.position.set(-1.02, H2/2, Dp/2+.002); g.add(face); ARCH.meshes.push(face); fadeMats.push(face.material);
  for (let i=0;i<4;i++) B(.3,.03,.04, metal, -1.02, 1.56 - i*.45, Dp/2+.03);
  // prateleiras com pastas (lado direito)
  [.08,.66,1.26].forEach(y => B(1.97,.04,Dp-.04, walnut, .67,y+.02,0));
  const binders = new THREE.Group(); g.add(binders); ARCH.binders = binders;
  // placa
  const plateTex = canvasTex(512, 64, (c,w,h) => {
    c.fillStyle = '#2a1f17'; c.fillRect(0,0,w,h);
    c.fillStyle = '#e7c98f'; c.font = '700 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('ARQUIVO DO ESCRITÓRIO', w/2, h/2+2);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6,.2), new THREE.MeshStandardMaterial({map:plateTex, roughness:.4, transparent:true}));
  plate.position.set(.25, H2+.16, 0); g.add(plate); ARCH.meshes.push(plate); fadeMats.push(plate.material);
  B(1.7,.26,.04, dark, .25, H2+.16, -.03);
  const anchor = new THREE.Object3D(); anchor.position.set(.25, H2+.55, 0); g.add(anchor); ARCH.anchor = anchor;
  ARCH.fadeMats = fadeMats;
  ARCH.meshes.forEach(o => o.userData.agentId = 'arquivo');
  obstacleRect(0, 6.62, Math.PI, -W2/2-.02, W2/2+.02, -Dp/2, Dp/2+.05);
}
/* Desenha as pastas e rótulos a partir das contagens REAIS de arquivos */
function paintArchive(catCounts, periodCounts, CATS){
  const b = ARCH.binders; while (b.children.length){ const o = b.children.pop(); o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  const rows = [[0,1,2],[3,4,5],[6,7,8]];
  rows.forEach((row, ri) => {
    const y = [1.3, .7, .12][ri];
    row.forEach((ci, k) => {
      const cat = CATS[ci], n = catCounts[cat.id] || 0, x0 = -.28 + k*.66;
      const shown = Math.min(n, 7);
      for (let i=0;i<shown;i++){
        const o = box(.075, .42, .32, mat(cat.color, .75), b, x0 + i*.085, y + .23, .02);
        o.rotation.z = i === shown-1 && shown < 7 ? -.12 : 0;
        o.userData.agentId = 'arquivo';
      }
      // etiqueta da seção
      const t = canvasTex(256, 64, (c,w,h) => {
        c.fillStyle = '#efe6d4'; c.fillRect(0,0,w,h);
        c.fillStyle = cat.color; c.fillRect(0,0,12,h);
        c.fillStyle = '#2a211b'; c.font = '600 26px sans-serif'; c.textBaseline = 'middle';
        c.fillText(`${cat.label} · ${n}`, 22, h/2+1);
      });
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(.62,.155), new THREE.MeshStandardMaterial({map:t, roughness:.6, transparent:true}));
      lab.position.set(x0 + .3, y + .045, (.5/2) - .005); lab.rotation.x = -.35; b.add(lab);
      lab.userData.agentId = 'arquivo';
    });
  });
  b.traverse(o => { if (o.isMesh && !o.material.map){ o.material = o.material.clone(); o.material.transparent = true; } });
  const {ctx:c, c:cv} = ARCH.drawerTex.userData, w = cv.width, h = cv.height;
  c.fillStyle = '#6b4a33'; c.fillRect(0,0,w,h);
  const labels = [['HOJE', periodCounts.hoje], ['ESTA SEMANA', periodCounts.semana], ['ESTE MÊS', periodCounts.mes], ['TODOS', periodCounts.todos]];
  labels.forEach(([lab, n], i) => {
    const y0 = i*128;
    c.fillStyle = '#5c3f2b'; c.fillRect(6, y0+6, w-12, 116);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.strokeRect(6, y0+6, w-12, 116);
    c.fillStyle = '#efe6d4'; c.fillRect(48, y0+18, w-96, 46);
    c.fillStyle = '#2a211b'; c.font = '700 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(lab, w/2, y0+34); c.font = '600 16px sans-serif'; c.fillText(`${n} arquivo${n===1?'':'s'}`, w/2, y0+54);
  });
  ARCH.drawerTex.needsUpdate = true;
}

/* =====================================================================
   ARMAZENAMENTO — uma única fonte de dados para o escritório inteiro.
   Gerente, Secretária, Central, Estante, Equipe e Relatórios leem daqui.
   Ordem de preferência:
     1) "Nuvem do Claude" (capacidades db + assets do artefato);
     2) IndexedDB deste navegador (ex.: quando publicado no GitHub Pages);
     3) memória (nada é salvo — o sistema avisa na tela).
   Para integrar no futuro (GitHub, Meta Ads, IA…), basta trocar/estender
   este objeto Store mantendo a mesma interface: list/on/put/del/saveBlob…
   ===================================================================== */
const Store = (() => {
  const COLS = ['tasks', 'files', 'notifs', 'settings'];
  const data = {}, subs = {};
  COLS.forEach(c => { data[c] = new Map(); subs[c] = []; });
  let ready = false, mode = 'mem', db = null, assets = null, downloads = null, idb = null, readOnly = false;
  const memBlobs = new Map(), localBlobKeys = new Set();
  const emit = c => { const arr = [...data[c].values()]; subs[c].forEach(f => f(arr)); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const queues = new Map();
  function queued(key, fn){ const p = (queues.get(key) || Promise.resolve()).then(fn, fn); queues.set(key, p.catch(() => {})); return p; }

  function idbOpen(){
    return new Promise(res => {
      try {
        const r = indexedDB.open('escritorio-virtual-marketing', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('docs'); r.result.createObjectStore('blobs'); };
        r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
        setTimeout(() => res(null), 4000);
      } catch (e) { res(null); }
    });
  }
  function idbDo(store, rw, fn){
    return new Promise((res, rej) => {
      try {
        const tx = idb.transaction(store, rw ? 'readwrite' : 'readonly');
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => res(req ? req.result : undefined);
        tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
      } catch (e) { rej(e); }
    });
  }

  async function init(){
    const cl = window.claude;
    if (cl && typeof cl.use === 'function'){
      const safe = n => cl.use(n).catch(() => null);
      [db, assets, downloads] = await Promise.all([safe('db'), safe('assets'), safe('downloads')]);
    }
    idb = await idbOpen();
    if (idb){ try { (await idbDo('blobs', false, s => s.getAllKeys()) || []).forEach(k => localBlobKeys.add(k)); } catch (e) {} }
    if (db){
      mode = 'cloud';
      await Promise.all(COLS.map(c => new Promise(res => {
        let first = true;
        db.collection(c).onSnapshot(snap => {
          data[c] = new Map(snap.docs.map(d => [d.id, Object.assign({}, d.data(), {id: d.id})]));
          emit(c); if (first){ first = false; res(); }
        }, err => { console.warn('db', c, err); if (first){ first = false; res(); } });
        setTimeout(() => { if (first){ first = false; res(); } }, 8000);
      })));
    } else if (idb){
      mode = 'local';
      try {
        const keys = await idbDo('docs', false, s => s.getAllKeys());
        const vals = await idbDo('docs', false, s => s.getAll());
        keys.forEach((k, i) => { const [c] = String(k).split('/'); if (data[c]) data[c].set(vals[i].id, vals[i]); });
      } catch (e) { console.warn(e); }
      COLS.forEach(emit);
    } else COLS.forEach(emit);
    ready = true; return mode;
  }

  function put(c, obj){
    obj = clone(obj); obj.updatedAt = Date.now();
    data[c].set(obj.id, obj); emit(c);
    const key = c + '/' + obj.id;
    if (mode === 'cloud') return queued(key, () => db.doc(key).set(obj)).catch(e => failWrite(e));
    if (mode === 'local') return queued(key, () => idbDo('docs', true, s => s.put(obj, key))).catch(e => failWrite(e));
    return Promise.resolve();
  }
  function del(c, id){
    data[c].delete(id); emit(c);
    const key = c + '/' + id;
    if (mode === 'cloud') return queued(key, () => db.doc(key).delete()).catch(e => failWrite(e));
    if (mode === 'local') return queued(key, () => idbDo('docs', true, s => s.delete(key))).catch(e => failWrite(e));
    return Promise.resolve();
  }
  /* gravação em lote (importação de backup): um só redesenho e, no navegador, uma só transação */
  async function putMany(c, list){
    const objs = list.map(o => { o = clone(o); o.updatedAt = o.updatedAt || Date.now(); data[c].set(o.id, o); return o; });
    emit(c);
    try {
      if (mode === 'cloud'){ for (const o of objs) await queued(c + '/' + o.id, () => db.doc(c + '/' + o.id).set(o)); }
      else if (mode === 'local') await idbDo('docs', true, s => { objs.forEach(o => s.put(o, c + '/' + o.id)); return null; });
    } catch (e){ failWrite(e); throw e; }
  }
  async function delMany(c, ids){
    ids.forEach(id => data[c].delete(id)); emit(c);
    try {
      if (mode === 'cloud'){ for (const id of ids) await queued(c + '/' + id, () => db.doc(c + '/' + id).delete()); }
      else if (mode === 'local') await idbDo('docs', true, s => { ids.forEach(id => s.delete(c + '/' + id)); return null; });
    } catch (e){ failWrite(e); throw e; }
  }
  function failWrite(e){
    console.warn('write', e);
    if (e && e.code === 'invalid_argument'){ readOnly = true; onError('Você só tem permissão de leitura neste escritório. A alteração não foi salva.'); }
    else if (e && e.code === 'quota_exceeded') onError('O armazenamento está cheio. Exclua tarefas ou notificações antigas.');
    else onError('Não foi possível salvar a última alteração. Verifique a conexão e tente de novo.');
  }
  let onError = () => {};

  /* ---- arquivos reais (binários) ---- */
  const ASSET_TYPES = {png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml',
    mp4:'video/mp4', webm:'video/webm', pdf:'application/pdf', csv:'text/csv', md:'text/markdown', json:'application/json', txt:'text/plain'};
  const ext = name => (String(name).split('.').pop() || '').toLowerCase();
  async function saveBlob(blob, name){
    const type = ASSET_TYPES[ext(name)];
    let assetNote = '';
    if (assets && type){
      try { const r = await assets.upload(blob, {type}); return {storage:'assets', assetId: r.id}; }
      catch (e){ console.warn('assets', e); assetNote = e && e.code === 'too_large' ? 'grande demais para a nuvem (limite 20 MB)' : 'a nuvem recusou o arquivo'; }
    } else if (assets && !type) assetNote = 'formato não aceito pela nuvem';
    if (idb){
      const key = 'b_' + uid();
      try { await idbDo('blobs', true, s => s.put(blob, key)); localBlobKeys.add(key); return {storage:'local', localKey:key, storageNote: assetNote}; }
      catch (e) { console.warn(e); }
    }
    const key = 'm_' + uid(); memBlobs.set(key, blob);
    return {storage:'mem', localKey:key, storageNote: assetNote || 'sem armazenamento disponível'};
  }
  function available(f){
    if (f.storage === 'assets') return !!f.assetId;
    if (f.storage === 'local') return localBlobKeys.has(f.localKey);
    if (f.storage === 'mem') return memBlobs.has(f.localKey);
    return false;
  }
  async function getBlob(f){
    if (f.storage === 'assets'){ const r = await fetch('/_blob/' + f.assetId); if (!r.ok) throw new Error('404'); return r.blob(); }
    if (f.storage === 'local'){ const b = await idbDo('blobs', false, s => s.get(f.localKey)); if (!b) throw new Error('missing'); return b; }
    if (f.storage === 'mem'){ const b = memBlobs.get(f.localKey); if (!b) throw new Error('missing'); return b; }
    throw new Error('missing');
  }
  function viewUrl(f){ return f.storage === 'assets' ? '/_blob/' + f.assetId : null; }
  async function removeBlob(f){
    try {
      if (f.storage === 'assets' && assets) await assets.delete(f.assetId);
      if (f.storage === 'local' && idb){ await idbDo('blobs', true, s => s.delete(f.localKey)); localBlobKeys.delete(f.localKey); }
      if (f.storage === 'mem') memBlobs.delete(f.localKey);
    } catch (e) { console.warn(e); }
  }
  async function download(f){
    const blob = await getBlob(f);
    if (downloads){
      try { await downloads.save({filename: f.name, data: blob}); return 'saved'; }
      catch (e){
        if (e && e.code === 'declined') return 'declined';
        if (e && (e.code === 'rejected_extension' || e.code === 'extension_not_enabled')) throw new Error(`O formato .${ext(f.name)} não pode ser baixado por esta janela. Abra o arquivo aqui mesmo ou envie-o em outro formato (mp4, pdf, png, txt…).`);
        if (e && e.code === 'rate_limited') throw new Error('Já existe um download aguardando confirmação.');
        throw new Error('Não foi possível iniciar o download.');
      }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000); return 'saved';
  }
  async function downloadText(name, text){
    return download({storage:'mem', localKey: (memBlobs.set('dl', new Blob([text], {type:'text/plain'})), 'dl'), name});
  }
  return {init, put, del, putMany, delMany, on:(c, f) => subs[c].push(f), all:c => [...data[c].values()], get:(c, id) => data[c].get(id),
    saveBlob, available, getBlob, viewUrl, removeBlob, download, downloadText,
    get mode(){ return mode; }, get ready(){ return ready; }, get readOnly(){ return readOnly; }, set onError(f){ onError = f; }};
})();
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* =====================================================================
   REGRAS DO ESCRITÓRIO — pessoas, etapas, fluxos, tipos, prioridades, status
   ===================================================================== */
const YOU = {id:'voce', emoji:'🧑', name:'Você', role:'Proprietário'};
const person = id => byId[id] || (id === 'voce' ? YOU : {id, emoji:'•', name:'Sem responsável', role:''});
const RESP_IDS = ['pesquisador','copywriter','criativo','analista','social','gerente','secretaria','voce'];
/* Fluxo padrão (ordem oficial) e responsável padrão de cada etapa */
const STAGES = {
  pesquisa:    {label:'Pesquisa', resp:'pesquisador', cat:'documentos', done:'Pesquisa concluída', started:'Pesquisa iniciada'},
  copy:        {label:'Copy', resp:'copywriter', cat:'textos', done:'Copy concluída', started:'Copy iniciada'},
  roteiro:     {label:'Roteiro', resp:'copywriter', cat:'roteiros', done:'Roteiro concluído', started:'Roteiro iniciado'},
  criativo:    {label:'Criativo', resp:'criativo', cat:'imagens', done:'Criativo concluído', started:'Criativo iniciado'},
  revisao:     {label:'Revisão', resp:'gerente', cat:'documentos', done:'Revisão concluída', started:'Revisão iniciada'},
  finalizacao: {label:'Finalização', resp:'gerente', cat:'videos', done:'Finalização concluída', started:'Finalização iniciada'},
  publicacao:  {label:'Publicação', resp:'social', cat:'posts', done:'Publicação concluída', started:'Publicação iniciada'},
  analise:     {label:'Análise', resp:'analista', cat:'relatorios', done:'Análise concluída', started:'Análise iniciada'},
  arquivamento:{label:'Arquivamento', resp:'secretaria', cat:'outros', done:'Arquivamento concluído', started:'Arquivamento iniciado'},
};
const STAGE_ORDER = Object.keys(STAGES);
/* Tipos de tarefa — cada um sugere um fluxo personalizado (o fluxo padrão tem as 9 etapas) */
const TEMPLATES = [
  {id:'campanha', label:'Campanha completa', stages: STAGE_ORDER.slice()},
  {id:'video', label:'Vídeo / Reels', stages:['pesquisa','copy','roteiro','criativo','revisao','finalizacao','publicacao','arquivamento']},
  {id:'post', label:'Post / Carrossel', stages:['pesquisa','copy','criativo','revisao','publicacao','arquivamento']},
  {id:'anuncio', label:'Anúncio (Meta Ads)', stages:['pesquisa','copy','criativo','revisao','publicacao','analise','arquivamento']},
  {id:'texto', label:'Texto / Artigo', stages:['pesquisa','copy','revisao','publicacao','arquivamento']},
  {id:'relatorio', label:'Relatório de resultados', stages:['analise','revisao','arquivamento']},
  {id:'outro', label:'Outro', stages: STAGE_ORDER.slice()},
];
const typeLabel = id => (TEMPLATES.find(x => x.id === id) || {}).label || 'Tarefa';
const PRIORITIES = {urgente:['Urgente','pr-urg',0], alta:['Alta','pr-alta',1], media:['Média','pr-media',2], baixa:['Baixa','pr-baixa',3]};
const CATS = [
  {id:'videos', label:'Vídeos', color:'#b5543c', icon:'🎬'}, {id:'imagens', label:'Imagens', color:'#6a5aa3', icon:'🖼️'},
  {id:'textos', label:'Textos', color:'#2f5d7c', icon:'📝'}, {id:'anuncios', label:'Anúncios', color:'#d9a441', icon:'📣'},
  {id:'posts', label:'Posts', color:'#b4546e', icon:'📱'}, {id:'roteiros', label:'Roteiros', color:'#3d6b5e', icon:'🎞️'},
  {id:'documentos', label:'Documentos', color:'#8a6a4c', icon:'📄'}, {id:'relatorios', label:'Relatórios', color:'#3c6f96', icon:'📊'},
  {id:'outros', label:'Outros', color:'#6b7280', icon:'📦'},
];
const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
/* Modelos de arquivo de texto: só estruturam o conteúdo que VOCÊ escreve (não geram texto) */
const DOC_MODELS = {
  livre:     {label:'Texto livre', cat:'textos', prefix:'texto', body: () => ''},
  copy:      {label:'Copy', cat:'textos', prefix:'copy', body: t => `COPY — ${t}\n\nGancho:\n\nTexto principal:\n\nChamada para ação:\n`},
  roteiro:   {label:'Roteiro', cat:'roteiros', prefix:'roteiro', body: t => `ROTEIRO — ${t}\n\nCena 1 (0–3s):\n\nCena 2:\n\nCena 3:\n\nEncerramento / chamada:\n`},
  briefing:  {label:'Briefing', cat:'documentos', prefix:'briefing', body: t => `BRIEFING — ${t}\n\nObjetivo:\n\nPúblico:\n\nMensagem principal:\n\nCanais:\n\nPrazo:\n\nObservações:\n`},
  relatorio: {label:'Relatório', cat:'relatorios', prefix:'relatorio', body: t => `RELATÓRIO — ${t}\n\nPeríodo:\n\nO que foi feito:\n\nResultados observados:\n\nPróximos passos:\n`},
};
const TSTATUS = {nao:['Não iniciada','st-nao'], agu:['Aguardando','st-agu'], and:['Em andamento','st-and'], rev:['Em revisão','st-rev'], ok:['Concluída','st-ok'], prob:['Problema','st-prob'], pau:['Pausada','st-pau']};

/* Configurações (responsáveis padrão por etapa) — guardadas junto com os dados */
function getSettings(){ const s = Store.get('settings', 'geral'); return Object.assign({id:'geral', stageResp:{}}, s || {}); }
const defaultResp = key => getSettings().stageResp[key] || STAGES[key].resp;
function setDefaultResp(key, resp){ const s = JSON.parse(JSON.stringify(getSettings())); s.stageResp[key] = resp; Store.put('settings', s); }

/* Compatibilidade com tarefas criadas nas versões anteriores */
function fillDefaults(t){
  if (!t.code) t.code = 'T-' + String(t.id).slice(-4).toUpperCase();
  if (!t.type) t.type = t.template || 'outro';
  if (!t.priority) t.priority = 'media';
  return t;
}
function taskStatus(t){
  if (t.stages.every(s => s.status === 'concluida')) return 'ok';
  if (t.hold === 'pausada') return 'pau';
  if (t.hold === 'problema') return 'prob';
  const s = t.stages[t.cur];
  if (s && s.status === 'andamento') return s.key === 'revisao' ? 'rev' : 'and';
  if (!t.stages.some(x => x.startedAt)) return 'nao';
  return 'agu';
}
const taskProgress = t => t.stages.length ? t.stages.filter(s => s.status === 'concluida').length / t.stages.length : 0;
const curStage = t => taskStatus(t) === 'ok' ? null : t.stages[t.cur];
const nextStage = t => t.stages[t.cur + 1] || null;
const isActive = t => taskStatus(t) !== 'ok';
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const isLate = t => isActive(t) && !!t.due && t.due < todayStr();
const lastUpdate = t => (t.history && t.history.length) ? t.history[t.history.length - 1].t : t.createdAt;
/* estado da etapa i: concluída / atual (em andamento) / aguardando / bloqueada */
function stageState(t, i){
  const s = t.stages[i];
  if (s.status === 'concluida') return 'concluida';
  if (i === t.cur && s.status === 'andamento') return 'atual';
  if (i === t.cur && s.status === 'aguardando') return 'aguardando';
  return 'bloqueada';
}
const STAGE_STATE_L = {concluida:'Concluída', atual:'Atual — em andamento', aguardando:'Aguardando início', bloqueada:'Bloqueada'};
function guessCat(file){
  const m = file.type || '', e = (file.name.split('.').pop() || '').toLowerCase();
  if (m.startsWith('video/') || ['mp4','mov','webm','avi','mkv'].includes(e)) return 'videos';
  if (m.startsWith('image/')) return 'imagens';
  if (['pdf','doc','docx','odt'].includes(e)) return 'documentos';
  if (['txt','md'].includes(e)) return 'textos';
  if (['csv','xlsx','xls'].includes(e)) return 'relatorios';
  return null;
}

/* ---------- datas ---------- */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const p2 = n => String(n).padStart(2, '0');
const fmt = ts => { if (!ts) return '—'; const d = new Date(ts); return `${p2(d.getDate())}/${p2(d.getMonth()+1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const fmtFull = ts => { if (!ts) return '—'; const d = new Date(ts); return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const fmtDate = s => { if (!s) return '—'; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmtSize = b => b == null ? '' : b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(0) + ' KB' : (b/1048576).toFixed(1) + ' MB';
function dur(ms){ if (ms == null || ms < 0) return '—'; const m = Math.round(ms/60000); if (m < 60) return m + ' min'; const h = m/60; if (h < 48) return h.toFixed(1).replace('.', ',') + ' h'; return (h/24).toFixed(1).replace('.', ',') + ' dias'; }
const PERIODS = [
  {id:'hoje', label:'Hoje'}, {id:'ontem', label:'Ontem'}, {id:'semana', label:'Esta semana'}, {id:'semanaPassada', label:'Semana passada'},
  {id:'mes', label:'Este mês'}, {id:'mesPassado', label:'Mês passado'}, {id:'mesesAnteriores', label:'Meses anteriores'},
  {id:'ano', label:'Este ano'}, {id:'anoPassado', label:'Ano passado'}, {id:'todos', label:'Todos os arquivos'},
];
function periodRange(id){
  const n = new Date(), sod = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), day = 864e5;
  const dow = (n.getDay() + 6) % 7, monday = sod - dow*day;             // semana de segunda a domingo
  const m0 = new Date(n.getFullYear(), n.getMonth(), 1).getTime(), mPrev = new Date(n.getFullYear(), n.getMonth()-1, 1).getTime();
  const y0 = new Date(n.getFullYear(), 0, 1).getTime(), yPrev = new Date(n.getFullYear()-1, 0, 1).getTime();
  return {hoje:[sod, Infinity], ontem:[sod-day, sod], semana:[monday, Infinity], semanaPassada:[monday-7*day, monday],
    mes:[m0, Infinity], mesPassado:[mPrev, m0], mesesAnteriores:[-Infinity, mPrev], ano:[y0, Infinity], anoPassado:[yPrev, y0], todos:[-Infinity, Infinity]}[id];
}
const inPeriod = (ts, id) => { const [a, b] = periodRange(id); return ts >= a && ts < b; };
const periodLabel = id => (PERIODS.find(p => p.id === id) || {}).label || '';
function locationOf(f){ const d = new Date(f.createdAt); return `Estante › ${d.getFullYear()} › ${MESES[d.getMonth()]} › ${(catById[f.cat] || catById.outros).label}`; }

/* =====================================================================
   AÇÕES — o motor da Central. Tudo passa por aqui, fica no histórico
   e gera notificação quando é um evento. "by" hoje é sempre "voce"
   (o proprietário); no futuro poderá ser "ia" ou "automacao".
   Nenhuma etapa é concluída sem uma ação sua.
   ===================================================================== */
const now = () => Date.now();
const hist = (t, txt, kind = 'info', by = 'voce') => { t.history = t.history || []; t.history.push({t: now(), txt, kind, by}); };
function notify(txt, kind, taskId, fileId, to){
  Store.put('notifs', {id: uid(), t: now(), txt, kind, taskId: taskId || null, fileId: fileId || null, to: to || null, read: false});
  const all = Store.all('notifs').sort((a, b) => a.t - b.t);
  if (all.length > 300) all.slice(0, all.length - 300).forEach(n => Store.del('notifs', n.id));
}
const T = id => { const t = Store.get('tasks', id); return t ? fillDefaults(JSON.parse(JSON.stringify(t))) : null; };
function nextCode(){
  let max = 0; Store.all('tasks').forEach(t => { const m = /^T-(\d+)$/.exec(t.code || ''); if (m) max = Math.max(max, +m[1]); });
  return 'T-' + String(max + 1).padStart(4, '0');
}
function assignNote(t, s){ hist(t, `Etapa ${s.label} atribuída a ${person(s.resp).name} — aguardando início.`, 'atribuicao'); notify(`Etapa ${s.label} atribuída a ${person(s.resp).name}: ${t.title}`, 'atribuicao', t.id); }
function createTask({title, desc, type, priority, due, notes, stages}){
  const t = {id: uid(), code: nextCode(), title, desc, type, template: type, priority: priority || 'media', createdAt: now(), startedAt: null, doneAt: null, due: due || '', notes: notes || '',
    hold: null, holdNote: '', cur: 0, stages: stages.map((s, i) => ({key: s.key, label: STAGES[s.key].label, resp: s.resp, status: i ? 'pendente' : 'aguardando', startedAt: null, doneAt: null})), history: []};
  hist(t, `Tarefa ${t.code} criada — ${typeLabel(type)}, prioridade ${PRIORITIES[t.priority][0].toLowerCase()}${t.due ? ', prazo ' + fmtDate(t.due) : ''}. Fluxo: ${t.stages.map(s => s.label).join(' → ')}.`, 'criacao');
  if (notes) hist(t, `Observação: ${notes}`, 'observacao');
  hist(t, `Etapa ${t.stages[0].label} atribuída a ${person(t.stages[0].resp).name} — aguardando início.`, 'atribuicao');
  Store.put('tasks', t);
  notify(`Nova tarefa atribuída a ${person(t.stages[0].resp).name} (${t.stages[0].label}): ${t.title}`, 'atribuicao', t.id);
  return t;
}
function startStage(id){
  const t = T(id); if (!t) return false; const s = t.stages[t.cur]; if (!s || s.status !== 'aguardando' || t.hold) return false;
  s.status = 'andamento'; s.startedAt = now(); if (!t.startedAt) t.startedAt = s.startedAt;
  hist(t, `${person(s.resp).name} iniciou ${s.label}.`, 'inicio'); Store.put('tasks', t);
  if (s.key === 'revisao') notify(`Tarefa em revisão com ${person(s.resp).name}: ${t.title}`, 'revisao', t.id);
  else notify(`${STAGES[s.key].started} por ${person(s.resp).name}: ${t.title}`, 'inicio', t.id);
  return true;
}

const AI_AUTO_STAGES = new Set(['pesquisa','copy','roteiro','criativo','revisao','finalizacao','analise']);
const AUTO_RUNNERS = new Set();

function cleanAIText(text){
  let x = String(text || '').trim();
  x = x.replace(/^```(?:svg|xml|html|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return x;
}

function inferOrderType(order){
  const q = norm(order);
  if (/\b(video|reel|reels|video curto)\b/.test(q)) return 'video';
  if (/\b(anuncio|ads|trafego pago|meta ads)\b/.test(q)) return 'anuncio';
  if (/\b(relatorio|metricas|resultados|analise de campanha)\b/.test(q)) return 'relatorio';
  if (/\b(artigo|texto longo|artigo para blog)\b/.test(q)) return 'texto';
  if (/\b(campanha|campanha completa)\b/.test(q)) return 'campanha';
  if (/\b(post|carrossel|criativo|arte|imagem|banner|card|story|stories)\b/.test(q)) return 'post';
  return 'outro';
}

function autoStagesFor(type){
  const tpl = TEMPLATES.find(x => x.id === type) || TEMPLATES.find(x => x.id === 'outro');
  return tpl.stages.map(key => ({key, resp: defaultResp(key)}));
}

function autoStageInstruction(stageKey, task, context){
  const base = `Pedido original do proprietário:\n${task.desc || task.title}\n\nContexto e resultados anteriores disponíveis:\n${context || 'Nenhum resultado anterior.'}`;
  const common = 'Você trabalha no Escritório Virtual de Marketing — Salário-Maternidade. Seja objetivo e produza um resultado utilizável. Não invente fatos, números, leis, fontes ou ações externas. Se algo não puder ser verificado com os dados disponíveis, deixe isso explícito.';
  const map = {
    pesquisa: `${common}\n\nVocê é Lívia, pesquisadora. Não finja que navegou na internet: neste momento você não possui busca web. Faça um levantamento estratégico usando apenas o pedido e o contexto fornecido. Organize público, objetivo, mensagem central, pontos que precisam de verificação externa e recomendações úteis para Rafael e Bia.`,
    copy: `${common}\n\nVocê é Rafael, copywriter. Produza a copy pronta para uso: gancho, texto principal, CTA e, quando adequado, legenda. Aproveite o contexto da pesquisa sem repetir informações não verificadas como fatos.`,
    roteiro: `${common}\n\nVocê é Rafael, roteirista. Produza um roteiro pronto para gravação, dividido por cenas, com abertura forte, falas/textos de tela e CTA.`,
    criativo: `${common}\n\nVocê é Bia, diretora criativa. Entregue o CRIATIVO FINAL como SVG válido, completo e autossuficiente, preferencialmente em 1080x1350 para post ou 1080x1920 para story/reel. Use apenas formas, cores e textos vetoriais; não use imagens externas, links ou scripts. O SVG deve estar pronto para ser visualizado na Estante. Retorne SOMENTE o código SVG, começando por <svg e terminando por </svg>. Inclua texto legível em português e uma composição profissional de marketing para o pedido.`,
    revisao: `${common}\n\nVocê é Marcos, gerente. Revise os materiais produzidos nas etapas anteriores. Verifique clareza, coerência com o pedido, CTA, consistência e riscos de afirmações não verificadas. Se o material principal for um SVG, devolva uma versão SVG corrigida e pronta; caso contrário, devolva uma versão final corrigida do texto. Não apenas dê opinião: entregue o material revisado.`,
    finalizacao: `${common}\n\nVocê é Marcos, responsável pela finalização. Consolide os resultados anteriores em uma entrega final clara e pronta para uso. Se já existir um criativo SVG aprovado, não o transforme em texto: registre a entrega e produza um pequeno arquivo de instruções/legenda final.`,
    analise: `${common}\n\nVocê é Otávio, analista. Analise os materiais e o objetivo da tarefa. Como não há métricas externas conectadas agora, não invente números. Produza um relatório com o que foi produzido, pontos fortes, pendências e quais métricas deverão ser acompanhadas quando a campanha for publicada.`,
  };
  return `${map[stageKey] || common}\n\n${base}`;
}

async function previousStageContext(taskId){
  const files = Store.all('files').filter(f => f.taskId === taskId).sort((a,b) => a.createdAt - b.createdAt);
  const chunks = [];
  for (const f of files.slice(-10)){
    let body = '';
    try {
      if (Store.available(f)){
        const b = await Store.getBlob(f);
        if ((f.mime || '').startsWith('text/') || /\.(txt|md|json|svg)$/i.test(f.name)) body = await b.text();
      }
    } catch(e) {}
    chunks.push(`ARQUIVO: ${f.name}\nETAPA: ${f.stageKey ? STAGES[f.stageKey].label : '—'}\n${body.slice(0,12000)}`);
  }
  return chunks.join('\n\n---\n\n');
}

function resultFileSpec(stageKey, resultText, task){
  const isSvg = /<svg[\s>]/i.test(resultText) && /<\/svg>/i.test(resultText);
  const ext = isSvg ? 'svg' : 'txt';
  const mime = isSvg ? 'image/svg+xml' : 'text/plain;charset=utf-8';
  const prefix = stageKey === 'pesquisa' ? 'pesquisa' : stageKey === 'copy' ? 'copy' : stageKey === 'roteiro' ? 'roteiro' : stageKey === 'criativo' ? 'criativo' : stageKey === 'revisao' ? (isSvg ? 'criativo_revisado' : 'revisao') : stageKey;
  const safe = norm(task.code + '_' + task.title).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,48);
  return {name:`${prefix}_${safe}_${new Date().toISOString().slice(0,10)}.${ext}`, mime, blob:new Blob([resultText], {type:mime})};
}

async function executeAutoStage(id){
  const t = T(id); if (!t) return {ok:false, mensagem:'Tarefa não encontrada.'};
  const s = t.stages[t.cur];
  if (!s || !AI_AUTO_STAGES.has(s.key) || s.status !== 'andamento' || t.hold) return {ok:false, mensagem:'Etapa não disponível para execução automática.'};
  const ia = window.EVIntegracoes && window.EVIntegracoes.ia;
  if (!ia || typeof ia.executar !== 'function' || !ia.conectada()) return {ok:false, mensagem:'A IA não está conectada ao escritório.'};

  const context = await previousStageContext(id);
  const prompt = autoStageInstruction(s.key, t, context);
  hist(t, `${person(s.resp).name} recebeu ${s.label} para execução automática.`, 'ia_inicio', 'automacao');
  await Store.put('tasks', t);
  notify(`${person(s.resp).name} está trabalhando em ${s.label}: ${t.title}`, 'ia', t.id);
  renderHUD(); syncAgents(); dirty = true;

  const result = await ia.executar({agente:person(s.resp).name, etapa:s.label, tarefa:t, instrucao:prompt});
  const atual = T(id);
  if (!atual) return {ok:false, mensagem:'A tarefa deixou de existir durante a execução.'};
  if (!result.ok || !result.text){
    hist(atual, `${person(s.resp).name} não conseguiu concluir ${s.label}: ${result.mensagem || 'sem resultado'}.`, 'ia_erro', 'automacao');
    await Store.put('tasks', atual);
    notify(`Problema em ${s.label}: ${atual.title}`, 'ia_erro', atual.id, null, ['gerente','secretaria']);
    renderHUD(); syncAgents();
    return result;
  }

  const final = T(id); const sf = final && final.stages[final.cur];
  if (!final || !sf || sf.status !== 'andamento') return {ok:false, mensagem:'A etapa mudou antes da entrega.'};
  const cleaned = cleanAIText(result.text);
  const spec = resultFileSpec(sf.key, cleaned, final);
  await attachFiles(final.id, final.cur, [{blob:spec.blob,name:spec.name}], STAGES[sf.key].cat, sf.resp, 'ia_gemini_auto');
  const after = T(id);
  if (after && after.stages[after.cur] && after.stages[after.cur].status === 'andamento'){
    completeStage(id, `Resultado produzido automaticamente e guardado na Estante como ${spec.name}.`);
    const done = T(id); hist(done, `${person(sf.resp).name} entregou ${sf.label} automaticamente.`, 'ia_conclusao', 'automacao'); await Store.put('tasks', done);
    notify(`${sf.label} concluída: ${done.title}`, 'ia_conclusao', done.id);
  }
  renderHUD(); syncAgents(); dirty = true;
  return {ok:true,text:cleaned,fileName:spec.name};
}

async function runTaskAutomation(id){
  if (AUTO_RUNNERS.has(id)) return;
  AUTO_RUNNERS.add(id);
  try {
    let guard = 0;
    while (guard++ < 20){
      const t = T(id); if (!t || taskStatus(t) === 'ok' || t.hold) break;
      const s = curStage(t); if (!s) break;
      if (s.status === 'aguardando') startStage(id);
      const current = T(id); const cs = current && curStage(current); if (!cs) break;
      if (cs.key === 'publicacao'){
        completeStage(id, 'Publicação preparada automaticamente. Nenhuma rede social foi acessada ou publicada nesta versão.');
        notify(`Material pronto para publicação manual: ${current.title}`, 'entrega', current.id, null, ['voce']);
        continue;
      }
      if (cs.key === 'arquivamento'){
        completeStage(id, 'Arquivamento realizado automaticamente na Estante.');
        continue;
      }
      const r = await executeAutoStage(id);
      if (!r.ok) break;
    }
    const final = T(id);
    if (final && taskStatus(final) === 'ok'){
      notify(`✅ Marcos entregou a tarefa pronta: ${final.title}. O material está na Estante.`, 'entrega', final.id, null, ['voce']);
      toast(`✅ Marcos entregou: ${final.title}. Veja na Estante.`);
    }
    renderHUD(); syncAgents(); if (H.view) renderHub(); if (panelAgent) renderPanel();
  } finally { AUTO_RUNNERS.delete(id); }
}

function aiInstructionForStage(stageKey){ return `Execute a etapa ${STAGES[stageKey] ? STAGES[stageKey].label : stageKey} de forma completa e entregue um resultado utilizável.`; }

function completeStage(id, note){
  const t = T(id); if (!t) return; const s = t.stages[t.cur]; if (!s || s.status !== 'andamento' || t.hold) return;
  s.status = 'concluida'; s.doneAt = now();
  hist(t, `${STAGES[s.key].done} por ${person(s.resp).name}${note ? ' — ' + note : ''}.`, 'conclusao');
  notify(`${STAGES[s.key].done}: ${t.title}`, 'etapa', t.id);
  if (s.key === 'arquivamento') notify(`Tarefa arquivada: ${t.title}`, 'arquivada', t.id);
  const nx = t.stages[t.cur + 1];
  if (nx){ t.cur++; nx.status = 'aguardando'; assignNote(t, nx); }
  else { t.doneAt = now(); hist(t, 'Tarefa concluída.', 'conclusao'); notify(`Tarefa concluída: ${t.title}`, 'tarefa', t.id); }
  Store.put('tasks', t);
}
/* Devolver para ajustes: volta para uma etapa anterior (padrão: a imediatamente anterior) */
function returnStage(id, note, toIdx){
  const t = T(id); if (!t || t.cur === 0) return; const s = t.stages[t.cur];
  if (!s || s.status === 'concluida') return;
  const target = toIdx == null ? t.cur - 1 : Math.max(0, Math.min(t.cur - 1, toIdx));
  for (let i = target + 1; i <= t.cur; i++){ const x = t.stages[i]; x.status = 'pendente'; x.startedAt = null; x.doneAt = null; }
  const pv = t.stages[target]; pv.status = 'aguardando'; pv.doneAt = null; pv.startedAt = null; t.cur = target;
  if (t.hold){ t.hold = null; t.holdNote = ''; }
  hist(t, `Devolvida para ajustes: de ${s.label} para ${pv.label} (${person(pv.resp).name})${note ? ' — motivo: ' + note : ''}.`, 'devolucao');
  Store.put('tasks', t);
  notify(`Tarefa devolvida para ${pv.label} (${person(pv.resp).name}): ${t.title}`, 'devolucao', t.id);
}
function setHold(id, hold, note, who){
  const t = T(id); if (!t) return;
  if (hold === 'problema'){
    t.hold = 'problema'; t.holdNote = note || ''; t.holdBy = who || 'voce';
    hist(t, `Problema identificado por ${person(t.holdBy).name}${note ? ': ' + note : ''}.`, 'problema');
    Store.put('tasks', t);
    notify(`Problema em "${t.title}" (identificado por ${person(t.holdBy).name})${note ? ': ' + note : ''}`, 'problema', t.id, null, ['gerente','secretaria']);
    return;
  }
  if (hold === 'pausada'){ t.hold = 'pausada'; t.holdNote = note || ''; hist(t, `Tarefa pausada${note ? ' — motivo: ' + note : ''}.`, 'pausa'); }
  else { hist(t, t.hold === 'problema' ? 'Problema resolvido; tarefa retomada.' : 'Tarefa retomada.', 'retomada'); t.hold = null; t.holdNote = ''; t.holdBy = null; }
  Store.put('tasks', t);
}
function addNote(id, text){ const t = T(id); if (!t || !text) return; hist(t, `Observação: ${text}`, 'observacao'); Store.put('tasks', t); }
function setNotes(id, notes){ const t = T(id); if (!t) return; t.notes = notes; hist(t, `Observações atualizadas: ${notes || '(em branco)'}`, 'observacao'); Store.put('tasks', t); }
function setTaskField(id, field, value){
  const t = T(id); if (!t || t[field] === value) return;
  const L = {priority:'Prioridade', due:'Prazo'};
  const show = v => field === 'priority' ? PRIORITIES[v][0] : field === 'due' ? (v ? fmtDate(v) : 'sem prazo') : v;
  hist(t, `${L[field]} alterado: ${show(t[field])} → ${show(value)}.`, 'info'); t[field] = value; Store.put('tasks', t);
}
function setResp(id, i, resp){
  const t = T(id); if (!t) return; const s = t.stages[i]; if (!s || s.status === 'concluida' || s.resp === resp) return;
  hist(t, `Responsável por ${s.label} alterado: ${person(s.resp).name} → ${person(resp).name}.`, 'responsavel'); s.resp = resp;
  Store.put('tasks', t);
  if (i === t.cur) notify(`Etapa ${s.label} atribuída a ${person(resp).name}: ${t.title}`, 'atribuicao', t.id);
}
async function attachFiles(taskId, stageIdx, list, cat, resp, origin){
  const results = [];
  for (const {blob, name} of list){
    const saved = await Store.saveBlob(blob, name);
    const t0 = Store.get('tasks', taskId);
    const f = Object.assign({id: uid(), name, cat, mime: blob.type || '', size: blob.size, taskId, taskTitle: t0 ? t0.title : '', taskCode: t0 ? t0.code || '' : '',
      stageKey: t0 && t0.stages[stageIdx] ? t0.stages[stageIdx].key : null, resp, createdAt: now(), by: 'voce', origin}, saved);
    await Store.put('files', f); results.push(f);
    const t = T(taskId);
    if (t){ hist(t, `Arquivo "${name}" guardado na estante (${catById[cat].label}, etapa ${f.stageKey ? STAGES[f.stageKey].label : '—'}), por ${person(resp).name}${f.storage !== 'assets' && Store.mode === 'cloud' ? ' — salvo só neste navegador' : ''}.`, 'arquivo'); Store.put('tasks', t); }
    notify(`Novo arquivo disponível: ${name}`, 'arquivo', taskId, f.id);
  }
  return results;
}
async function deleteFile(fid){
  const f = Store.get('files', fid); if (!f) return;
  await Store.removeBlob(f); await Store.del('files', fid);
  const t = T(f.taskId); if (t){ hist(t, `Arquivo "${f.name}" excluído da estante.`, 'arquivo'); Store.put('tasks', t); }
}
function deleteTask(id){
  Store.del('tasks', id);
  Store.all('files').filter(f => f.taskId === id).forEach(f => { const c = Object.assign({}, f, {taskDeleted: true}); Store.put('files', c); });
}

/* =====================================================================
   EXPORTAR / IMPORTAR BACKUP (JSON)
   ===================================================================== */
const BACKUP_APP = 'escritorio-virtual-marketing';
function blobToBase64(blob){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }
function base64ToBlob(b64, type){ const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], {type: type || ''}); }
async function exportData(withContent){
  const files = [];
  let skipped = 0;
  for (const f of Store.all('files')){
    const meta = JSON.parse(JSON.stringify(f));
    if (withContent && Store.available(f)){
      try { meta.contentBase64 = await blobToBase64(await Store.getBlob(f)); } catch (e) { skipped++; }
    } else if (withContent) skipped++;
    files.push(meta);
  }
  return {data: {app: BACKUP_APP, version: 2, exportedAt: new Date().toISOString(), tasks: Store.all('tasks'), notifications: Store.all('notifs'), files, settings: Store.all('settings')}, skipped};
}
function readBackup(obj){
  if (!obj || obj.app !== BACKUP_APP || !Array.isArray(obj.tasks)) throw new Error('Este arquivo não é um backup do Escritório Virtual.');
  return {tasks: obj.tasks.length, files: (obj.files || []).length, notifs: (obj.notifications || []).length, withContent: (obj.files || []).filter(f => f.contentBase64).length, exportedAt: obj.exportedAt};
}
let quietNotifs = false;   // durante a importação, não mostrar um aviso por notificação restaurada
async function importData(obj, mode){
  readBackup(obj);
  quietNotifs = true;
  try {
    if (mode === 'substituir'){
      for (const f of Store.all('files')) await Store.removeBlob(f);
      for (const c of ['tasks','files','notifs','settings']) await Store.delMany(c, Store.all(c).map(d => d.id));
    }
    await Store.putMany('settings', obj.settings || []);
    await Store.putMany('tasks', obj.tasks);
    await Store.putMany('notifs', obj.notifications || []);
    const files = [];
    for (const f of (obj.files || [])){
      const meta = Object.assign({}, f); const b64 = meta.contentBase64; delete meta.contentBase64;
      if (b64){ Object.assign(meta, {assetId: null, localKey: null}, await Store.saveBlob(base64ToBlob(b64, meta.mime), meta.name)); }
      else { const cur = Store.get('files', meta.id); if (cur && Store.available(cur)) Object.assign(meta, {storage: cur.storage, assetId: cur.assetId || null, localKey: cur.localKey || null}); else meta.storage = 'missing'; }
      files.push(meta);
    }
    await Store.putMany('files', files);
  } finally { quietNotifs = false; }
}
/* tarefas antigas ganham ID, tipo e prioridade padrão ao serem carregadas */
Store.on('tasks', list => list.forEach(fillDefaults));

/* =====================================================================
   SECRETÁRIA — responde só com o que está registrado na Central e na Estante
   (a mesma fonte de dados de todo o escritório). Não há IA aqui: são
   consultas diretas. Sem registro, ela diz que não encontrou.
   ===================================================================== */
const NADA = 'Não encontrei essa informação no sistema.';
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set('a o as os de da do das dos e em no na nos nas um uma para por com que qual quais como esta estao ja tem foi ser sobre isso esse essa este meu minha me voce ficou pronto pronta tarefa tarefas campanha arquivo arquivos quem onde mostre mostra quando feito feita sendo agora ultima ultimo quantas quantos'.split(' '));
const PERSON_WORDS = [['pesquisador',['livia','pesquisador','pesquisadora']],['copywriter',['rafael','copywriter']],['criativo',['bia','criativa','criativo']],
  ['analista',['otavio','analista']],['social',['carol','social media']],['gerente',['marcos','gerente']],['secretaria',['helena','secretaria']]];
function linesTask(t){
  const st = TSTATUS[taskStatus(t)][0], s = curStage(t), nx = s ? nextStage(t) : null;
  let r = `• ${t.code} ${t.title} — ${st}, ${Math.round(taskProgress(t)*100)}%`;
  if (s) r += `. Etapa atual: ${s.label} com ${person(s.resp).name} (${s.status === 'andamento' ? 'em andamento' : 'aguardando início'})`;
  if (nx) r += `. Depois: ${nx.label} (${person(nx.resp).name})`;
  if (t.due) r += `. Prazo: ${fmtDate(t.due)}${isLate(t) ? ' (atrasada)' : ''}`;
  if (t.hold) r += `. ${t.hold === 'pausada' ? 'Pausada' : 'Problema'}${t.holdNote ? ': ' + t.holdNote : ''}`;
  return r + '.';
}
const linesFile = f => `• ${f.name} — ${(catById[f.cat]||catById.outros).label}, ${fmt(f.createdAt)}, tarefa "${f.taskTitle || '—'}"${f.stageKey ? ', etapa ' + STAGES[f.stageKey].label : ''}. Local: ${locationOf(f)}.`;
function agentWork(id){
  const tasks = Store.all('tasks');
  const act = tasks.filter(isActive);
  const doing = act.filter(t => curStage(t).resp === id && curStage(t).status === 'andamento');
  const waiting = act.filter(t => curStage(t).resp === id && curStage(t).status === 'aguardando');
  const queue = act.filter(t => curStage(t).resp !== id && t.stages.some((s, i) => i > t.cur && s.resp === id));
  const pend = act.filter(t => t.stages.some(s => s.resp === id && s.status !== 'concluida'));
  const done = tasks.filter(t => t.stages.some(s => s.resp === id) && t.stages.filter(s => s.resp === id).every(s => s.status === 'concluida'));
  let stagesDone = 0; tasks.forEach(t => t.stages.forEach(s => { if (s.resp === id && s.status === 'concluida') stagesDone++; }));
  return {doing, waiting, queue, pend, done, stagesDone};
}
function secretaryAnswer(qRaw){
  const q = ' ' + norm(qRaw) + ' ', tasks = Store.all('tasks'), files = Store.all('files').sort((a, b) => b.createdAt - a.createdAt);
  const active = tasks.filter(isActive), has = (...w) => w.some(x => q.includes(x));
  let per = null;
  if (has('semana passada')) per = 'semanaPassada';
  else if (has('mes passado')) per = 'mesPassado';
  else if (has('meses anteriores')) per = 'mesesAnteriores';
  else if (has('ano passado')) per = 'anoPassado';
  else if (has('hoje')) per = 'hoje';
  else if (has('ontem')) per = 'ontem';
  else if (has('semana')) per = 'semana';
  else if (/\bmes\b/.test(q)) per = 'mes';
  else if (/\bano\b/.test(q)) per = 'ano';
  const CATW = [['videos',['video','reels']],['imagens',['imagem','imagens',' arte','foto','capa']],['roteiros',['roteiro']],['textos',['texto','copy','legenda']],
    ['anuncios',['anuncio']],['posts',[' post','publicac']],['relatorios',['relatorio','analise']],['documentos',['documento','briefing','pdf']]];
  const catHit = (CATW.find(([, ws]) => ws.some(w => q.includes(w))) || [])[0] || null;
  const personHit = (PERSON_WORDS.find(([, ws]) => ws.some(w => q.includes(w))) || [])[0] || null;
  const words = q.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
  let match = null, best = 0;
  tasks.forEach(t => { const tw = norm(t.code + ' ' + t.title + ' ' + (t.desc || '')); const sc = words.filter(w => tw.includes(w)).length; if (sc > best){ best = sc; match = t; } });
  if (best < 1 || (catHit && best < 2 && words.length <= 2)) match = null;

  if (!tasks.length && !files.length) return 'A Central de Tarefas ainda está vazia: nenhuma tarefa e nenhum arquivo registrados. Crie a primeira tarefa com o gerente ou em "Nova tarefa".';

  // 1) arquivos / produção por período
  if (per && (has('arquivo','produz','feito','entreg','pronto','conclu','criad','mostre','mostra','quais') || catHit)){
    const fs = files.filter(f => inPeriod(f.createdAt, per) && (!catHit || f.cat === catHit));
    const stDone = [];
    tasks.forEach(t => t.stages.forEach(s => { if (s.doneAt && inPeriod(s.doneAt, per)) stDone.push({t, s}); }));
    stDone.sort((a, b) => b.s.doneAt - a.s.doneAt);
    const pl = periodLabel(per).toLowerCase();
    if (!fs.length && !stDone.length) return `${NADA} Nenhum arquivo${catHit ? ' de ' + catById[catHit].label.toLowerCase() : ''} e nenhuma etapa concluída registrados em "${pl}".`;
    let r = fs.length ? `Arquivos${catHit ? ' de ' + catById[catHit].label.toLowerCase() : ''} de ${pl} (${fs.length}):\n` + fs.slice(0, 12).map(linesFile).join('\n') + (fs.length > 12 ? `\n…e mais ${fs.length-12} na Estante.` : '') : `Nenhum arquivo registrado em "${pl}".`;
    if (stDone.length) r += `\n\nEtapas concluídas em "${pl}":\n` + stDone.slice(0, 10).map(({t, s}) => `• ${fmt(s.doneAt)} — ${s.label} de "${t.title}" (${person(s.resp).name})`).join('\n');
    return r;
  }
  // 2) onde está o arquivo
  if (has('onde')){
    let fs = files;
    const byName = files.filter(f => words.some(w => norm(f.name).includes(w) || norm((f.taskCode || '') + ' ' + (f.taskTitle || '')).includes(w)));
    if (byName.length) fs = byName; else if (catHit) fs = files.filter(f => f.cat === catHit); else if (words.length) fs = [];
    if (!fs.length) return `${NADA} Não há arquivo${catHit ? ' de ' + catById[catHit].label.toLowerCase() : ''}${words.length ? ' com esse nome' : ''} guardado na Estante.`;
    return 'Encontrei na Estante:\n' + fs.slice(0, 8).map(linesFile).join('\n') + '\nVocê pode abrir ou baixar pela Estante / Arquivo.';
  }
  // 3) tarefa de uma pessoa
  if (personHit){
    const p = person(personHit), w = agentWork(personHit);
    let r = `${p.name} (${p.role}): ${w.pend.length} tarefa${w.pend.length === 1 ? '' : 's'} pendente${w.pend.length === 1 ? '' : 's'} e ${w.done.length} concluída${w.done.length === 1 ? '' : 's'}.`;
    if (w.doing.length) r += '\nFazendo agora:\n' + w.doing.map(t => `• ${t.code} ${t.title} — ${curStage(t).label}, desde ${fmt(curStage(t).startedAt)}${t.due ? ', prazo ' + fmtDate(t.due) : ''}`).join('\n');
    if (w.waiting.length) r += '\nAguardando início:\n' + w.waiting.map(t => `• ${t.code} ${t.title} — ${curStage(t).label}`).join('\n');
    if (w.queue.length) r += '\nNa fila (etapas futuras):\n' + w.queue.map(t => `• ${t.code} ${t.title}`).join('\n');
    const held = Store.all('tasks').filter(t => isActive(t) && t.hold && curStage(t).resp === personHit);
    if (held.length) r += '\nParadas:\n' + held.map(linesTask).join('\n');
    if (!w.doing.length && !w.waiting.length && !w.queue.length && !held.length) r += `\nNão há nenhuma tarefa ativa com ${p.name} no momento.`;
    return r;
  }
  // 4) tipo de entrega (vídeo, texto, roteiro…)
  if (catHit && has('pronto','pronta','ficou','finaliz','tem ','existe','ja ','termin','saiu','feito')){
    const pool = match ? files.filter(f => f.taskId === match.id) : files;
    const fs = pool.filter(f => f.cat === catHit);
    const stageFor = {videos:['finalizacao','criativo'], imagens:['criativo'], roteiros:['roteiro'], textos:['copy'], anuncios:['criativo','copy'], posts:['publicacao'], relatorios:['analise'], documentos:['pesquisa']}[catHit] || [];
    const rel = [];
    (match ? [match] : tasks).forEach(t => t.stages.forEach(s => { if (stageFor.includes(s.key)) rel.push({t, s}); }));
    let r = fs.length ? `Sim, há ${fs.length} arquivo${fs.length > 1 ? 's' : ''} de ${catById[catHit].label.toLowerCase()} na Estante:\n` + fs.slice(0, 6).map(linesFile).join('\n')
      : `Não há nenhum arquivo de ${catById[catHit].label.toLowerCase()} guardado na Estante${match ? ` para "${match.title}"` : ''}.`;
    if (rel.length) r += '\n\nEtapas relacionadas:\n' + rel.slice(0, 8).map(({t, s}) => `• ${s.label} de "${t.title}": ${s.status === 'concluida' ? 'concluída em ' + fmt(s.doneAt) : s.status === 'andamento' ? 'em andamento com ' + person(s.resp).name : s.status === 'aguardando' ? 'aguardando início (' + person(s.resp).name + ')' : 'ainda não chegou nessa etapa'}`).join('\n');
    else if (!fs.length) r = `${NADA} Nenhuma tarefa registrada tem etapa de ${catById[catHit].label.toLowerCase()}.`;
    return r;
  }
  // 5) revisão
  if (has('revis')){
    const rel = [];
    (match ? [match] : tasks).forEach(t => t.stages.forEach(s => { if (s.key === 'revisao') rel.push({t, s}); }));
    if (!rel.length) return `${NADA} Nenhuma tarefa${match ? ' com esse nome' : ''} possui etapa de revisão.`;
    return 'Situação das revisões:\n' + rel.map(({t, s}) => `• "${t.title}": ${s.status === 'concluida' ? 'revisada em ' + fmt(s.doneAt) + ' por ' + person(s.resp).name : s.status === 'andamento' ? 'em revisão agora com ' + person(s.resp).name : s.status === 'aguardando' ? 'aguardando a revisão de ' + person(s.resp).name : 'ainda não chegou na revisão'}`).join('\n');
  }
  // 6) problemas
  if (has('problema','erro','dificuldade')){
    const pr = tasks.filter(t => isActive(t) && t.hold === 'problema');
    return pr.length ? 'Tarefas com problema registrado:\n' + pr.map(t => linesTask(t) + ` Identificado por ${person(t.holdBy || 'voce').name}.`).join('\n') : 'Não há nenhum problema registrado na Central no momento.';
  }
  // 7) paradas / atrasadas
  if (has('parad','atras','travad','esquecid','sem andamento')){
    const lim = now() - 48*3600e3;
    const pr = active.filter(t => t.hold || lastUpdate(t) < lim || isLate(t));
    return pr.length ? 'Tarefas paradas ou atrasadas (pausadas, com problema, sem movimento há mais de 48 horas ou com prazo vencido):\n' + pr.map(t => linesTask(t) + ` Última movimentação: ${fmt(lastUpdate(t))}.`).join('\n') : 'Nenhuma tarefa parada ou atrasada: todas as tarefas ativas tiveram movimentação nas últimas 48 horas e estão dentro do prazo.';
  }
  // 8) próxima etapa
  if (has('proxim','depois','em seguida')){
    const L = (match ? [match] : active).filter(isActive);
    if (!L.length) return `${NADA} Não há tarefas ativas.`;
    return 'Próximas etapas:\n' + L.map(t => { const s = curStage(t), nx = nextStage(t); return `• "${t.title}": agora ${s.label} (${person(s.resp).name}, ${s.status === 'andamento' ? 'em andamento' : 'aguardando início'})${nx ? `; depois ${nx.label} com ${person(nx.resp).name}` : '; é a última etapa'}.`; }).join('\n');
  }
  // 9) última concluída
  if (has('ultim') && has('conclu','termin','finaliz','entreg')){
    const done = tasks.filter(t => taskStatus(t) === 'ok').sort((a, b) => b.doneAt - a.doneAt);
    const st = []; tasks.forEach(t => t.stages.forEach(s => s.doneAt && st.push({t, s}))); st.sort((a, b) => b.s.doneAt - a.s.doneAt);
    if (!done.length && !st.length) return `${NADA} Nenhuma tarefa ou etapa foi concluída até agora.`;
    let r = done.length ? `Última tarefa concluída: ${done[0].code} ${done[0].title}, em ${fmtFull(done[0].doneAt)}.` : 'Nenhuma tarefa foi concluída por inteiro ainda.';
    if (st.length) r += `\nÚltima etapa concluída: ${st[0].s.label} de "${st[0].t.title}" (${person(st[0].s.resp).name}), em ${fmtFull(st[0].s.doneAt)}.`;
    return r;
  }
  // 10) quantidades
  if (has('quant')){
    const c = k => tasks.filter(t => taskStatus(t) === k).length;
    return `Na Central há ${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}: ${c('ok')} concluída${c('ok') === 1 ? '' : 's'}, ${c('and')} em andamento, ${c('rev')} em revisão, ${c('agu')} aguardando, ${c('nao')} não iniciada${c('nao') === 1 ? '' : 's'}, ${c('prob')} com problema e ${c('pau')} pausada${c('pau') === 1 ? '' : 's'}. ${tasks.filter(isLate).length} atrasada(s). Na Estante: ${files.length} arquivo${files.length === 1 ? '' : 's'}.`;
  }
  // 11) tarefa específica
  if (match && !has('quem','pendent','conclu','notifica')){
    const t = match, fs = files.filter(f => f.taskId === t.id);
    return linesTask(t) + `\nPrioridade ${PRIORITIES[t.priority][0].toLowerCase()}. Criada em ${fmtFull(t.createdAt)}${t.startedAt ? `, iniciada em ${fmtFull(t.startedAt)}` : ', ainda não iniciada'}${t.doneAt ? `, concluída em ${fmtFull(t.doneAt)}` : ''}. Última atualização: ${fmtFull(lastUpdate(t))}.` +
      (fs.length ? `\nArquivos (${fs.length}):\n` + fs.slice(0, 6).map(linesFile).join('\n') : '\nNenhum arquivo guardado para essa tarefa.');
  }
  // 12) quem está trabalhando
  if (has('quem','fazendo','sendo feito','trabalhando','responsavel','com a tarefa')){
    const now_ = active.filter(t => !t.hold && curStage(t).status === 'andamento'), wait = active.filter(t => !t.hold && curStage(t).status === 'aguardando');
    if (!now_.length && !wait.length) return 'Ninguém está com etapa em andamento agora. ' + (active.length ? 'As tarefas ativas estão pausadas ou com problema.' : 'Não há tarefas ativas.');
    let r = now_.length ? 'Trabalhando agora:\n' + now_.map(t => { const s = curStage(t); return `• ${person(s.resp).name} (${person(s.resp).role}) — ${s.label} de "${t.title}", desde ${fmt(s.startedAt)}`; }).join('\n') : 'Nenhuma etapa em andamento neste momento.';
    if (wait.length) r += '\n\nAguardando início:\n' + wait.map(t => { const s = curStage(t); return `• ${person(s.resp).name} — ${s.label} de "${t.title}"`; }).join('\n');
    return r;
  }
  // 13) pendências
  if (has('pendent','falta','a fazer','aberto')){
    return active.length ? `Pendentes (${active.length}):\n` + active.map(linesTask).join('\n') : 'Não há nada pendente: todas as tarefas registradas estão concluídas.';
  }
  // 14) arquivos em geral
  if (has('arquivo','estante')){
    if (!files.length) return 'Ainda não há nenhum arquivo guardado na Estante.';
    return `Há ${files.length} arquivo${files.length > 1 ? 's' : ''} na Estante. Os mais recentes:\n` + files.slice(0, 6).map(linesFile).join('\n');
  }
  // 15) concluídas
  if (has('conclu','termin','finaliz','pront','entreg')){
    const done = tasks.filter(t => taskStatus(t) === 'ok').sort((a, b) => b.doneAt - a.doneAt);
    const st = []; tasks.forEach(t => t.stages.forEach(s => s.doneAt && st.push({t, s}))); st.sort((a, b) => b.s.doneAt - a.s.doneAt);
    if (!done.length && !st.length) return `${NADA} Nenhuma tarefa ou etapa foi concluída até agora.`;
    let r = done.length ? `Tarefas concluídas (${done.length}):\n` + done.slice(0, 8).map(t => `• ${t.code} ${t.title} — ${fmtFull(t.doneAt)}`).join('\n') : 'Nenhuma tarefa concluída por inteiro ainda.';
    if (st.length) r += '\n\nÚltimas etapas concluídas:\n' + st.slice(0, 6).map(({t, s}) => `• ${fmt(s.doneAt)} — ${s.label} de "${t.title}" (${person(s.resp).name})`).join('\n');
    return r;
  }
  // 16) notificações
  if (has('notifica','novidade','aviso','aconteceu')){
    const ns = Store.all('notifs').sort((a, b) => b.t - a.t);
    return ns.length ? 'Últimos avisos registrados:\n' + ns.slice(0, 8).map(n => `• ${fmt(n.t)} — ${n.txt}`).join('\n') : 'Nenhuma notificação registrada ainda.';
  }
  // 17) resumo geral
  if (has('campanha','andamento','como esta','como estao','como vai','resumo','status','situacao','geral','escritorio','tarefas')) return officeSummary();
  return `${NADA}\nPosso consultar: tarefas em andamento, quem está trabalhando, a tarefa de cada pessoa (ex.: "Qual é a tarefa do Rafael?"), próximas etapas, pendências, revisões, problemas, tarefas paradas ou atrasadas, quantidades, a última concluída e arquivos por período (hoje, ontem, esta semana, semana passada, este mês…).`;
}
function officeSummary(){
  const tasks = Store.all('tasks'), files = Store.all('files');
  if (!tasks.length) return 'Não há tarefas registradas na Central no momento.';
  const c = k => tasks.filter(t => taskStatus(t) === k).length;
  const act = tasks.filter(isActive).sort(byPriority);
  let r = `Resumo do escritório: ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} registrada${tasks.length > 1 ? 's' : ''} — ${c('and')} em andamento, ${c('rev')} em revisão, ${c('agu')} aguardando, ${c('nao')} não iniciada${c('nao') === 1 ? '' : 's'}, ${c('prob')} com problema, ${c('pau')} pausada${c('pau') === 1 ? '' : 's'} e ${c('ok')} concluída${c('ok') === 1 ? '' : 's'}. ${tasks.filter(isLate).length} atrasada(s). Na Estante: ${files.length} arquivo${files.length === 1 ? '' : 's'}.`;
  if (act.length) r += '\n\n' + act.slice(0, 8).map(linesTask).join('\n');
  return r;
}
const byPriority = (a, b) => (PRIORITIES[a.priority][2] - PRIORITIES[b.priority][2]) || ((a.due || '9') .localeCompare(b.due || '9')) || (a.createdAt - b.createdAt);

/* =====================================================================
   INTERFACE
   ===================================================================== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastT = 0;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
Store.onError = msg => toast(msg);
const statusPillT = t => { const [l, c] = TSTATUS[taskStatus(t)]; return `<span class="pill ${c}"><span class="dot"></span>${l}</span>`; };
const prioPill = t => { const [l, c] = PRIORITIES[t.priority] || PRIORITIES.media; return `<span class="pill ${c}">${l}</span>`; };
const latePill = t => isLate(t) ? `<span class="pill st-prob">Atrasada</span>` : '';
const pName = id => { const p = person(id); return `${p.emoji} ${esc(p.name)}`; };
const IA_MSG = () => (window.EVIntegracoes && window.EVIntegracoes.ia.mensagem) || 'Automação de IA ainda não conectada.';
function stageActions(t){
  const st = taskStatus(t); if (st === 'ok') return '';
  if (t.hold) return `<button class="btn sm pri" data-act="resume" data-t="${t.id}" type="button">Retomar tarefa</button>`;
  const s = curStage(t), b = [];
  if (s.status === 'aguardando') b.push(`<button class="btn sm pri" data-act="start" data-t="${t.id}" type="button">Iniciar etapa: ${esc(s.label)}</button>`);
  if (s.status === 'andamento'){
    b.push(`<button class="btn sm ok" data-act="complete" data-t="${t.id}" type="button">${s.key === 'revisao' ? 'Concluir revisão' : 'Concluir etapa: ' + esc(s.label)}</button>`);
    b.push(`<button class="btn sm" data-act="deliver" data-t="${t.id}" type="button">Registrar entrega</button>`);
  }
  if (t.cur > 0) b.push(`<button class="btn sm" data-act="return" data-t="${t.id}" type="button">Devolver para ajustes</button>`);
  return b.join('');
}
function taskItem(t, opts = {}){
  const s = curStage(t), nx = s && nextStage(t), nf = Store.all('files').filter(f => f.taskId === t.id).length, p = taskProgress(t);
  return `<li class="item click ${t.hold === 'problema' ? 'is-prob' : ''}" data-open="${t.id}">
    <div class="h"><b><span class="mono code">${esc(t.code)}</span> ${esc(t.title)}</b><span class="row" style="gap:4px">${prioPill(t)}${latePill(t)}${statusPillT(t)}</span></div>
    <div class="meta">${s ? `Etapa ${t.cur + 1}/${t.stages.length}: <b style="color:var(--fg)">${esc(s.label)}</b> · ${pName(s.resp)} (${s.status === 'andamento' ? 'fazendo' : 'aguardando início'})${nx ? ` · depois: ${esc(nx.label)} (${esc(person(nx.resp).name)})` : ' · última etapa'}` : `Concluída em ${fmtFull(t.doneAt)}`}${t.hold && t.holdNote ? `<br>${t.hold === 'problema' ? 'Problema' : 'Pausa'}: ${esc(t.holdNote)}` : ''}</div>
    <div class="bar ${p >= 1 ? 'ok' : ''}"><i style="width:${Math.round(p*100)}%"></i></div>
    <div class="meta mono">${Math.round(p*100)}% · ${esc(typeLabel(t.type))} · criada ${fmt(t.createdAt)}${t.startedAt ? ' · início ' + fmt(t.startedAt) : ''} · atualizada ${fmt(lastUpdate(t))}${t.doneAt ? ' · fim ' + fmt(t.doneAt) : ''}${t.due ? ' · prazo ' + fmtDate(t.due) : ''} · ${nf} arquivo${nf === 1 ? '' : 's'}</div>
    ${opts.actions ? `<div class="row">${stageActions(t)}</div>` : ''}
  </li>`;
}
function fileItem(f){
  const cat = catById[f.cat] || catById.outros, ok = Store.available(f);
  return `<li class="item">
    <div class="h"><b>${cat.icon} ${esc(f.name)}</b><span class="pill" style="border-color:${cat.color}">${cat.label}</span></div>
    <div class="meta">${fmtFull(f.createdAt)}${f.size != null ? ' · ' + fmtSize(f.size) : ''} · Responsável: ${pName(f.resp)} · Etapa: ${f.stageKey && STAGES[f.stageKey] ? STAGES[f.stageKey].label : '—'}<br>Tarefa: ${f.taskDeleted ? esc(f.taskTitle) + ' (tarefa excluída)' : `<a href="#" data-open="${f.taskId}" style="color:var(--accent)">${esc((f.taskCode ? f.taskCode + ' ' : '') + f.taskTitle)}</a>`}<br>Local: ${esc(locationOf(f))}${f.storage === 'local' && Store.mode === 'cloud' ? '<br>Guardado só no navegador onde foi enviado.' : f.storage === 'mem' ? '<br>Guardado só nesta sessão (some ao recarregar).' : f.storage === 'missing' ? '<br>Veio de um backup sem o conteúdo do arquivo.' : ''}</div>
    <div class="row">${ok ? `<button class="btn sm pri" data-act="view" data-f="${f.id}" type="button">Abrir</button><button class="btn sm" data-act="dl" data-f="${f.id}" type="button">Baixar</button>` : `<span class="meta">Arquivo ainda não disponível.</span>`}
    <button class="btn sm danger" data-act="delfile" data-f="${f.id}" type="button">Excluir</button></div>
  </li>`;
}

/* ---------- HUD ---------- */
function renderHUD(){
  const tasks = Store.all('tasks'), act = tasks.filter(isActive), files = Store.all('files');
  const c = k => tasks.filter(t => taskStatus(t) === k).length, late = tasks.filter(isLate).length;
  if (!tasks.length){ $('#missionTxt').innerHTML = 'Nenhuma tarefa registrada. Fale com o gerente para começar.'; $('#missionBar').style.width = '0%'; }
  else {
    const p = act.length ? act.reduce((s, t) => s + taskProgress(t), 0) / act.length : 1;
    $('#missionTxt').innerHTML = `<b>${act.length}</b> ativa${act.length === 1 ? '' : 's'} · ${c('and')} em andamento · ${c('rev')} em revisão · ${c('prob') ? `<b style="color:var(--bad)">${c('prob')} com problema</b> · ` : ''}${late ? `<b style="color:var(--warn)">${late} atrasada${late === 1 ? '' : 's'}</b> · ` : ''}${c('ok')} concluída${c('ok') === 1 ? '' : 's'} · ${files.length} arquivo${files.length === 1 ? '' : 's'}`;
    $('#missionBar').style.width = Math.round(p*100) + '%';
  }
  const unread = Store.all('notifs').filter(n => !n.read).length;
  $('#notifBadge').hidden = !unread; $('#notifBadge').textContent = unread > 99 ? '99+' : unread;
}
function renderStoreBadge(){
  const m = Store.mode;
  $('#storeDot').style.background = m === 'cloud' ? 'var(--ok)' : m === 'local' ? 'var(--wait)' : 'var(--bad)';
  $('#storeTxt').textContent = m === 'cloud' ? 'Dados salvos no Claude (permanecem entre acessos)' : m === 'local' ? 'Dados salvos neste navegador (use Exportar dados para ter backup)' : 'Sem armazenamento: os dados somem ao recarregar';
}

/* ---------- Painel do personagem ---------- */
let panelAgent = null;
const chats = {secretaria: []};
function openAgent(a){
  if (a.isArchive){ openHub('arquivo'); return; }
  closeHub(true); panelAgent = a; $('#panel').hidden = false; renderPanel();
  if (a.id === 'secretaria') setTimeout(() => $('#pInput').focus(), 30);
}
function closePanel(){ panelAgent = null; $('#panel').hidden = true; }
$('#pClose').addEventListener('click', () => { closePanel(); canvas.focus(); });
const STATEL = {disp:['Disponível','s-disp'], trab:['Trabalhando','s-trab'], agu:['Aguardando','s-agu'], rev:['Em revisão','s-rev'], pau:['Pausado','s-pau'], coord:['Coordenando tarefas ativas','s-trab']};
function agentState(a){ return STATEL[a.state] || STATEL.disp; }
function agentHeader(a){
  const [lbl, cls] = agentState(a), w = agentWork(a.id);
  const cur = w.doing[0] || w.waiting[0] || Store.all('tasks').find(t => isActive(t) && t.hold && curStage(t).resp === a.id);
  const cs = cur && curStage(cur);
  return `<div class="row" style="justify-content:space-between"><span class="pill"><span class="dot ${cls}"></span>${lbl}</span>
      <button class="btn sm" data-act="agenttasks" data-a="${a.id}" type="button">Abrir tarefas de ${esc(a.name)} na Central</button></div>
    <div class="stats"><div class="stat"><span>Pendentes</span><b>${w.pend.length}</b></div><div class="stat"><span>Tarefas concluídas</span><b>${w.done.length}</b></div><div class="stat"><span>Etapas concluídas</span><b>${w.stagesDone}</b></div></div>
    <div><h4 class="sec">Tarefa atual</h4>${cur ? `<div class="item click" data-open="${cur.id}">
      <div class="h"><b><span class="mono code">${esc(cur.code)}</span> ${esc(cur.title)}</b><span class="row" style="gap:4px">${prioPill(cur)}${latePill(cur)}${statusPillT(cur)}</span></div>
      <div class="meta">Etapa: <b style="color:var(--fg)">${esc(cs.label)}</b> (${cur.hold ? (cur.hold === 'pausada' ? 'pausada' : 'com problema') : cs.status === 'andamento' ? 'em andamento desde ' + fmt(cs.startedAt) : 'aguardando início'}) · Prazo: ${cur.due ? fmtDate(cur.due) : 'sem prazo'}</div>
      <div class="bar"><i style="width:${Math.round(taskProgress(cur)*100)}%"></i></div><div class="meta mono">${Math.round(taskProgress(cur)*100)}% da tarefa</div>
      <div class="row">${stageActions(cur)}</div></div>` : '<p class="meta">Nenhuma tarefa atual.</p>'}</div>`;
}
function renderPanel(){
  const a = panelAgent; if (!a) return;
  $('#pAvatar').textContent = a.emoji; $('#pName').textContent = a.name; $('#pRole').textContent = a.role;
  const body = $('#pbody'), foot = $('#pfoot');
  if (a.id === 'secretaria'){
    const intro = `Olá, sou ${a.name}, secretária do gerente. Respondo consultando a Central de Tarefas e a Estante, sem inventar nada. O que você quer saber?`;
    const Q = ['Como estão as tarefas?','Quantas estão concluídas?','Quem está trabalhando agora?','Qual é a tarefa do Rafael?','Qual tarefa está parada?','Tem alguma tarefa com problema?','Qual é a próxima etapa?','Qual foi a última tarefa concluída?','Quais arquivos foram produzidos hoje?','O que foi produzido na semana passada?'];
    const alerts = Store.all('notifs').filter(n => !n.read && n.to && n.to.includes('secretaria')).sort((x, y) => y.t - x.t);
    body.innerHTML = `${agentHeader(a)}
      ${alerts.length ? `<div class="warnbox"><b>Alertas para a secretária (${alerts.length})</b><br>${alerts.slice(0, 4).map(n => `${fmt(n.t)} — ${esc(n.txt)}`).join('<br>')}</div>` : ''}
      <div><h4 class="sec">Pergunte à secretária</h4><div class="chips">${Q.map(q => `<button class="chip" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>
      <div class="chat" id="chatBox"><div class="msg a">${esc(intro)}</div>${chats.secretaria.map(m => `<div class="msg ${m.who}">${esc(m.txt)}</div>`).join('')}</div>`;
    foot.hidden = false; $('#pInput').placeholder = 'Pergunte à secretária';
    $('#pNote').textContent = 'Respostas geradas a partir dos dados registrados na Central e na Estante.';
    body.scrollTop = body.scrollHeight; return;
  }
  const tasks = Store.all('tasks');
  if (a.id === 'gerente'){ body.innerHTML = managerPanel(tasks); foot.hidden = false;
    $('#pInput').placeholder = 'Descreva a missão (ex.: Campanha salário-maternidade — gestantes)';
    $('#pNote').textContent = 'Diga o que você quer. Marcos distribui o trabalho e a equipe executa automaticamente. Publicação externa ainda não é feita.'; return; }
  // demais funcionários
  const w = agentWork(a.id);
  const doneS = []; tasks.forEach(t => t.stages.forEach(s => s.resp === a.id && s.doneAt && doneS.push({t, s}))); doneS.sort((x, y) => y.s.doneAt - x.s.doneAt);
  const myFiles = Store.all('files').filter(f => f.resp === a.id).sort((x, y) => y.createdAt - x.createdAt);
  const FOCUS = {pesquisador:'Pesquisas e documentos', copywriter:'Textos, copies e roteiros', criativo:'Criativos: imagens e vídeos', analista:'Análises e relatórios', social:'Posts e publicações'};
  const fila = [...w.doing, ...w.waiting, ...w.queue].filter((t, i, arr) => arr.indexOf(t) === i).sort(byPriority);
  let extra = '';
  if (a.id === 'social'){
    const cal = tasks.filter(t => t.due && t.stages.some(s => s.key === 'publicacao')).sort((x, y) => x.due.localeCompare(y.due));
    extra = `<div><h4 class="sec">Calendário de publicações (pelo prazo das tarefas)</h4>${cal.length ? `<ul class="hist">${cal.map(t => { const s = t.stages.find(x => x.key === 'publicacao'); return `<li><time>${fmtDate(t.due)}</time><span>${esc(t.title)} — ${s.status === 'concluida' ? 'publicação registrada' : s.status === 'andamento' ? 'publicando' : 'a publicar'}</span></li>`; }).join('')}</ul>` : '<p class="meta">Nenhuma tarefa com etapa de publicação e prazo.</p>'}
      <p class="meta">A publicação nas redes é feita por você; aqui você registra a etapa. Instagram, Facebook e TikTok não estão conectados.</p></div>`;
  }
  body.innerHTML = `${agentHeader(a)}
    <div><h4 class="sec">Fila de ${esc(a.name)} (${fila.length})</h4>${fila.length ? `<ul class="list">${fila.map(t => { const mine = t.stages.map((s, i) => ({s, i})).filter(x => x.s.resp === a.id && x.s.status !== 'concluida'); return `<li class="item click" data-open="${t.id}"><div class="h"><b><span class="mono code">${esc(t.code)}</span> ${esc(t.title)}</b><span class="row" style="gap:4px">${prioPill(t)}${latePill(t)}</span></div><div class="meta">Etapa${mine.length > 1 ? 's' : ''} de ${esc(a.name)}: ${mine.map(x => `${esc(x.s.label)} (${STAGE_STATE_L[stageState(t, x.i)].toLowerCase()})`).join(', ')}${t.due ? ' · prazo ' + fmtDate(t.due) : ''}</div></li>`; }).join('')}</ul>` : '<p class="meta">Nenhuma tarefa atribuída no momento.</p>'}</div>
    ${extra}
    <div><h4 class="sec">Etapas concluídas</h4>${doneS.length ? `<ul class="hist">${doneS.slice(0, 8).map(({t, s}) => `<li><time>${fmt(s.doneAt)}</time><span>${esc(s.label)} — ${esc(t.title)}</span></li>`).join('')}</ul>` : '<p class="meta">Nenhuma ainda.</p>'}</div>
    <div><h4 class="sec">${FOCUS[a.id] || 'Arquivos'} (${myFiles.length})</h4>${myFiles.length ? `<ul class="list">${myFiles.slice(0, 6).map(fileItem).join('')}</ul>` : '<p class="meta">Nenhum arquivo registrado por esta mesa.</p>'}</div>
    <p class="meta">🤖 ${esc(IA_MSG())} ${esc(a.name)} recebe as etapas automaticamente quando Marcos distribui a tarefa.</p>`;
  foot.hidden = true;
}
function managerPanel(tasks){
  const act = tasks.filter(isActive).sort(byPriority), c = k => tasks.filter(t => taskStatus(t) === k).length;
  const late = act.filter(isLate), prob = act.filter(t => t.hold === 'problema'), rev = act.filter(t => taskStatus(t) === 'rev');
  const mineNow = act.filter(t => !t.hold && curStage(t).resp === 'gerente' && taskStatus(t) !== 'rev');
  const alerts = Store.all('notifs').filter(n => !n.read && n.to && n.to.includes('gerente')).sort((x, y) => y.t - x.t);
  const ids = ['pesquisador','copywriter','criativo','gerente','social','analista','secretaria','voce'];
  const [lbl, cls] = agentState(byId.gerente);
  return `<div class="row" style="justify-content:space-between"><span class="pill"><span class="dot ${cls}"></span>${lbl}</span><button class="btn pri sm" data-act="newtask" type="button">+ Dar ordem a Marcos</button></div>
    <div class="stats">
      <div class="stat"><span>Pendentes</span><b>${act.length}</b></div><div class="stat"><span>Em andamento</span><b>${c('and')}</b></div>
      <div class="stat"><span>Em revisão</span><b>${c('rev')}</b></div><div class="stat"><span>Com problema</span><b>${c('prob')}</b></div>
      <div class="stat"><span>Concluídas</span><b>${c('ok')}</b></div><div class="stat"><span>Atrasadas</span><b>${late.length}</b></div></div>
    ${alerts.length ? `<div class="warnbox"><b>Alertas para o gerente (${alerts.length})</b><br>${alerts.slice(0, 4).map(n => `${fmt(n.t)} — ${esc(n.txt)}`).join('<br>')}</div>` : ''}
    ${prob.length ? `<div><h4 class="sec">Com problema</h4><ul class="list">${prob.map(t => taskItem(t, {actions:true})).join('')}</ul></div>` : ''}
    ${rev.length ? `<div><h4 class="sec">Em revisão</h4><ul class="list">${rev.map(t => taskItem(t, {actions:true})).join('')}</ul></div>` : ''}
    ${mineNow.length ? `<div><h4 class="sec">Etapas com o gerente</h4><ul class="list">${mineNow.map(t => taskItem(t, {actions:true})).join('')}</ul></div>` : ''}
    ${late.length ? `<div><h4 class="sec">Atrasadas</h4><ul class="list">${late.map(t => taskItem(t, {actions:true})).join('')}</ul></div>` : ''}
    <div><h4 class="sec">Tarefas por agente</h4><div class="tblwrap"><table class="tbl"><thead><tr><th>Agente</th><th>Fazendo</th><th>Aguardando</th><th>Pendentes</th><th>Concluídas</th></tr></thead><tbody>${ids.map(id => { const w = agentWork(id); return `<tr><td><button class="lnk" data-act="agenttasks" data-a="${id}" type="button">${pName(id)}</button></td><td>${w.doing.length}</td><td>${w.waiting.length}</td><td>${w.pend.length}</td><td>${w.done.length}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div><h4 class="sec">Todas as tarefas ativas (${act.length})</h4>${act.length ? `<ul class="list">${act.map(t => taskItem(t, {actions:true})).join('')}</ul>` : '<p class="empty">Nenhuma tarefa ativa. Descreva abaixo a próxima missão ou clique em "Criar tarefa".</p>'}</div>
    <details><summary class="sec" style="cursor:pointer">Responsáveis padrão das etapas</summary>
      <div class="stages-edit" style="margin-top:8px">${STAGE_ORDER.map(k => `<div class="se"><span>${STAGES[k].label}</span><span></span><select data-defresp="${k}" aria-label="Responsável padrão por ${STAGES[k].label}">${RESP_IDS.map(r => `<option value="${r}" ${r === defaultResp(k) ? 'selected' : ''}>${person(r).name}</option>`).join('')}</select></div>`).join('')}</div>
      <p class="meta">Vale para as próximas tarefas. Em cada tarefa, o responsável de qualquer etapa ainda não concluída pode ser trocado no painel da tarefa.</p></details>
    <div class="row"><button class="btn" data-hub-go="tarefas" type="button">Abrir Central de Tarefas</button><button class="btn" data-hub-go="relatorios" type="button">Relatórios</button><button class="btn" data-hub-go="arquivo" type="button">Estante</button></div>`;
}
$('#pInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('#pForm').requestSubmit(); } });
$('#pForm').addEventListener('submit', e => {
  e.preventDefault();
  const a = panelAgent, v = $('#pInput').value.trim(); if (!a || !v) return;
  $('#pInput').value = '';
  if (a.id === 'secretaria') ask(v);
  else if (a.id === 'gerente') openNewTask(v);
});
function ask(q){
  chats.secretaria.push({who:'u', txt:q}, {who:'a', txt: secretaryAnswer(q)});
  if (chats.secretaria.length > 60) chats.secretaria.splice(0, chats.secretaria.length - 60);
  renderPanel();
}

/* ---------- Hub (Central, Estante, Notificações, Equipe, Relatórios) ---------- */
const H = {view:null, prev:null, tFilter:'todas', tResp:'', tQ:'', aPer:'todos', aCat:'', aQ:'', taskId:null};
const HUBS = {tarefas:['📋','Central de Tarefas','O motor do escritório: tarefas, etapas, responsáveis e progresso'], arquivo:['📁','Estante / Arquivo','Arquivos reais produzidos, por período e por tipo'],
  notificacoes:['🔔','Notificações','Eventos registrados na Central e na Estante'], equipe:['👥','Equipe','Quem é quem e o que cada um está fazendo'], relatorios:['📊','Relatórios','Números calculados a partir dos dados registrados'], task:['📋','Tarefa','']};
let overview = false;
function openHub(v, arg){
  if (v === 'escritorio'){ closeHub(); closePanel(); overview = !overview; toast(overview ? 'Visão geral da sala. Clique em 🏢 de novo (ou C) para voltar.' : 'De volta à visão do personagem.'); syncMenu(); canvas.focus(); return; }
  if (v === 'task'){ if (H.view !== 'task') H.prev = H.view; H.taskId = arg; }
  H.view = v; closePanel(); $('#hub').hidden = false; document.body.classList.add('hubopen'); renderHub(); syncMenu(); $('#hbody').scrollTop = 0;
}
function closeHub(keepFocus){ H.view = null; $('#hub').hidden = true; document.body.classList.remove('hubopen'); syncMenu(); if (!keepFocus) canvas.focus(); }
function syncMenu(){ document.querySelectorAll('#menu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hub === H.view || (b.dataset.hub === 'escritorio' && overview) || (b.dataset.hub === 'tarefas' && H.view === 'task')))); }
$('#hClose').addEventListener('click', () => closeHub());
document.querySelectorAll('#menu button').forEach(b => b.addEventListener('click', () => H.view === b.dataset.hub ? closeHub() : openHub(b.dataset.hub)));
function markRead(ids){ Store.all('notifs').filter(n => !n.read && (!ids || ids.includes(n.id))).forEach(n => Store.put('notifs', Object.assign({}, n, {read: true}))); }

function renderHub(){
  const v = H.view; if (!v) return;
  const [ic, ti, sub] = HUBS[v];
  $('#hIcon').textContent = ic; $('#hTitle').textContent = ti; $('#hSub').textContent = sub;
  const b = $('#hbody');
  if (v === 'tarefas') b.innerHTML = hubTasks();
  else if (v === 'task') b.innerHTML = hubTask();
  else if (v === 'arquivo') b.innerHTML = hubArchive();
  else if (v === 'notificacoes') b.innerHTML = hubNotifs();
  else if (v === 'equipe') b.innerHTML = hubTeam();
  else if (v === 'relatorios') b.innerHTML = hubReports();
}
const FILTERS = [['todas','Todas'],['minhas','Minhas tarefas'],['and','Em andamento'],['agu','Aguardando'],['nao','Não iniciadas'],['rev','Em revisão'],['ok','Concluídas'],['prob','Com problema'],['pau','Pausadas'],['late','Atrasadas']];
function filterTasks(f){
  const tasks = Store.all('tasks');
  if (f === 'todas') return tasks;
  if (f === 'minhas') return tasks.filter(t => t.stages.some(s => s.resp === 'voce'));
  if (f === 'late') return tasks.filter(isLate);
  return tasks.filter(t => taskStatus(t) === f);
}
function hubTasks(){
  const tasks = Store.all('tasks');
  let list = filterTasks(H.tFilter);
  if (H.tResp) list = list.filter(t => t.stages.some(x => x.resp === H.tResp));
  if (H.tQ){ const q = norm(H.tQ); list = list.filter(t => norm(t.code + ' ' + t.title + ' ' + (t.desc || '')).includes(q)); }
  list.sort((x, y) => (isActive(y) - isActive(x)) || (isActive(x) ? byPriority(x, y) : (y.doneAt - x.doneAt)));
  const working = tasks.filter(t => isActive(t) && !t.hold && curStage(t).status === 'andamento');
  return `<div class="row" style="justify-content:space-between"><div class="meta">${tasks.length} tarefa${tasks.length === 1 ? '' : 's'} registrada${tasks.length === 1 ? '' : 's'}</div>
      <div class="row"><button class="btn sm" data-act="export" type="button">Exportar dados</button><button class="btn sm" data-act="import" type="button">Importar backup</button><button class="btn pri" data-act="newtask" type="button">+ Dar ordem a Marcos</button></div></div>
    <div><h4 class="sec">Quem está fazendo agora</h4>${working.length ? `<div class="chips">${working.map(t => { const s = curStage(t); return `<button class="chip" type="button" data-open="${t.id}">${pName(s.resp)} · ${esc(s.label)} · ${esc(t.title.length > 34 ? t.title.slice(0, 33) + '…' : t.title)}</button>`; }).join('')}</div>` : '<p class="meta">Nenhuma etapa em andamento neste momento.</p>'}</div>
    <div class="chips" role="group" aria-label="Filtrar por status">${FILTERS.map(([k, l]) => `<button class="chip" type="button" data-tf="${k}" aria-pressed="${H.tFilter === k}">${l}<b>${filterTasks(k).length}</b></button>`).join('')}</div>
    <div class="row"><select id="tResp" aria-label="Responsável" style="max-width:320px"><option value="">Todos os responsáveis</option>${RESP_IDS.map(id => `<option value="${id}" ${H.tResp === id ? 'selected' : ''}>${person(id).name} — ${person(id).role}</option>`).join('')}</select>
    <input type="search" id="tQ" placeholder="Buscar por ID ou título" value="${esc(H.tQ)}" style="max-width:260px"></div>
    ${list.length ? `<ul class="list">${list.map(t => taskItem(t, {actions:true})).join('')}</ul>` : `<p class="empty">${tasks.length ? 'Nenhuma tarefa neste filtro.' : 'Nenhuma tarefa registrada ainda. Clique em "Nova tarefa" ou fale com o gerente na mesa central.'}</p>`}`;
}
const HIST_ICON = {criacao:'🆕', atribuicao:'👤', inicio:'▶️', conclusao:'✅', responsavel:'🔁', problema:'⚠️', pausa:'⏸️', retomada:'⏯️', observacao:'📝', devolucao:'↩️', arquivo:'📁', info:'•'};
function hubTask(){
  const t = Store.get('tasks', H.taskId);
  if (!t) return `<div><button class="btn sm" data-act="back" type="button">← Voltar</button></div><p class="empty">Esta tarefa não existe mais (pode ter sido excluída).</p>`;
  $('#hTitle').textContent = `${t.code} · ${t.title}`; $('#hSub').textContent = typeLabel(t.type);
  const s = curStage(t), st = taskStatus(t), files = Store.all('files').filter(f => f.taskId === t.id).sort((x, y) => y.createdAt - x.createdAt), p = taskProgress(t);
  const nextResp = t.stages.slice(t.cur + 1).filter(x => x.status !== 'concluida').map(x => `${x.label}: ${person(x.resp).name}`);
  const holdBtns = st === 'ok' || t.hold ? '' : `<button class="btn sm" data-act="pause" data-t="${t.id}" type="button">Pausar tarefa</button><button class="btn sm danger" data-act="problem" data-t="${t.id}" type="button">Marcar problema</button>`;
  const pub = s && s.key === 'publicacao' ? `<p class="meta">📱 Publicação nas redes: Instagram, Facebook, TikTok e Meta Ads não estão conectados. Publique por fora e registre aqui a conclusão da etapa.</p>` : '';
  return `<div class="row" style="justify-content:space-between"><button class="btn sm" data-act="back" type="button">← Voltar</button><div class="row" style="gap:6px">${prioPill(t)}${latePill(t)}${statusPillT(t)}<span class="mono">${Math.round(p*100)}%</span></div></div>
    <div class="bar ${p >= 1 ? 'ok' : ''}"><i style="width:${Math.round(p*100)}%"></i></div>
    <div class="row">${stageActions(t)}${holdBtns}<button class="btn sm" data-act="deliver" data-t="${t.id}" type="button">Guardar arquivo</button><button class="btn sm" data-act="taskreport" data-t="${t.id}" type="button">Gerar relatório da tarefa (.txt)</button></div>
    ${t.hold ? `<div class="warnbox"><b>${t.hold === 'problema' ? 'Problema registrado' : 'Tarefa pausada'}</b>${t.hold === 'problema' ? ' por ' + esc(person(t.holdBy || 'voce').name) : ''}${t.holdNote ? ': ' + esc(t.holdNote) : ''}</div>` : ''}
    ${pub}
    <div class="grid2">
      <div><h4 class="sec">Informações</h4><dl class="kv">
        <dt>ID</dt><dd class="mono">${esc(t.code)}</dd><dt>Título</dt><dd>${esc(t.title)}</dd><dt>Tipo</dt><dd>${esc(typeLabel(t.type))}</dd>
        <dt>Prioridade</dt><dd><select data-field="priority" data-t="${t.id}" aria-label="Prioridade" class="inl">${Object.entries(PRIORITIES).map(([k, [l]]) => `<option value="${k}" ${t.priority === k ? 'selected' : ''}>${l}</option>`).join('')}</select></dd>
        <dt>Prazo</dt><dd><input type="date" class="inl" data-field="due" data-t="${t.id}" value="${esc(t.due)}" aria-label="Prazo">${isLate(t) ? ' <b style="color:var(--bad)">atrasada</b>' : ''}</dd>
        <dt>Responsável atual</dt><dd>${s ? pName(s.resp) : '—'}</dd>
        <dt>Status</dt><dd>${TSTATUS[st][0]}</dd><dt>Progresso</dt><dd>${Math.round(p*100)}% (${t.stages.filter(x => x.status === 'concluida').length} de ${t.stages.length} etapas)</dd>
        <dt>Etapa atual</dt><dd>${s ? `${esc(s.label)} (${STAGE_STATE_L[stageState(t, t.cur)].toLowerCase()})` : 'Todas concluídas'}</dd>
        <dt>Próximos responsáveis</dt><dd>${nextResp.length ? esc(nextResp.join(' · ')) : '—'}</dd>
        <dt>Criada</dt><dd>${fmtFull(t.createdAt)}</dd><dt>Início</dt><dd>${fmtFull(t.startedAt)}</dd><dt>Última atualização</dt><dd>${fmtFull(lastUpdate(t))}</dd><dt>Conclusão</dt><dd>${fmtFull(t.doneAt)}</dd></dl></div>
      <div><h4 class="sec">Descrição</h4><p class="meta" style="color:var(--fg);margin:0;white-space:pre-wrap">${esc(t.desc) || '—'}</p>
        <h4 class="sec" style="margin-top:14px">Automação de IA</h4><p class="meta">🤖 ${esc(IA_MSG())} Nenhum conteúdo é gerado automaticamente.</p></div>
    </div>
    <div><h4 class="sec">Fluxo</h4><ol class="stepper">${t.stages.map((x, i) => { const ss = stageState(t, i); return `<li class="step ${ss}">
      <span class="num">${ss === 'concluida' ? '✓' : i + 1}</span>
      <div class="sbody"><div class="h"><b>${esc(x.label)}</b><span class="pill ss-${ss}">${STAGE_STATE_L[ss]}</span></div>
      <div class="meta">${x.status === 'concluida' ? `${pName(x.resp)} · início ${fmt(x.startedAt)} · conclusão ${fmt(x.doneAt)}${x.startedAt ? ' · duração ' + dur(x.doneAt - x.startedAt) : ''}` : `Responsável: <select data-resp="${i}" data-t="${t.id}" class="inl" aria-label="Responsável por ${esc(x.label)}">${RESP_IDS.map(id => `<option value="${id}" ${x.resp === id ? 'selected' : ''}>${person(id).name}</option>`).join('')}</select>${x.startedAt ? ' · iniciada ' + fmt(x.startedAt) : ''}`}</div></div></li>`; }).join('')}</ol></div>
    <div><h4 class="sec">Observações</h4><textarea class="f" id="tNotes" data-t="${t.id}" placeholder="Anotações fixas da tarefa">${esc(t.notes)}</textarea>
      <div class="row" style="margin-top:6px"><button class="btn sm" data-act="savenotes" data-t="${t.id}" type="button">Salvar observações</button></div>
      <div class="row" style="margin-top:8px"><input type="text" id="tNewNote" placeholder="Registrar uma observação no histórico" style="flex:1;min-width:200px"><button class="btn sm" data-act="addnote" data-t="${t.id}" type="button">Registrar</button></div></div>
    <div><h4 class="sec">Arquivos da tarefa (${files.length})</h4>${files.length ? `<ul class="list">${files.map(fileItem).join('')}</ul>` : '<p class="meta">Nenhum arquivo guardado para esta tarefa.</p>'}</div>
    <div><h4 class="sec">Histórico</h4><ul class="hist">${(t.history || []).slice().reverse().map(h => `<li><time>${fmt(h.t)}</time><span>${HIST_ICON[h.kind] || '•'} ${esc(h.txt)} <em>· registrado por ${h.by === 'voce' ? 'você' : esc(h.by)}</em></span></li>`).join('')}</ul></div>
    <div class="row" id="delZone"><button class="btn sm danger" data-act="deltask" data-t="${t.id}" type="button">Excluir tarefa</button></div>`;
}
function hubArchive(){
  const files = Store.all('files').sort((x, y) => y.createdAt - x.createdAt);
  const inP = files.filter(f => inPeriod(f.createdAt, H.aPer));
  let list = H.aCat ? inP.filter(f => f.cat === H.aCat) : inP;
  if (H.aQ){ const q = norm(H.aQ); list = list.filter(f => norm(f.name + ' ' + (f.taskCode || '') + ' ' + (f.taskTitle || '')).includes(q)); }
  return `<div class="split">
    <nav class="shelfnav" aria-label="Gavetas por período">${PERIODS.map(p => `<button type="button" data-per="${p.id}" aria-pressed="${H.aPer === p.id}">${p.label}<b>${files.filter(f => inPeriod(f.createdAt, p.id)).length}</b></button>`).join('')}</nav>
    <div style="display:grid;gap:12px;align-content:start;min-width:0">
      <div class="row" style="justify-content:space-between"><h4 class="sec" style="margin:0">Gaveta: ${esc(periodLabel(H.aPer))}</h4><button class="btn pri sm" data-act="deliver" type="button">+ Guardar arquivo</button></div>
      <div class="chips" role="group" aria-label="Pastas por tipo"><button class="chip" type="button" data-cat="" aria-pressed="${!H.aCat}">Todas as pastas<b>${inP.length}</b></button>${CATS.map(c => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${H.aCat === c.id}">${c.icon} ${c.label}<b>${inP.filter(f => f.cat === c.id).length}</b></button>`).join('')}</div>
      <input type="search" id="aQ" placeholder="Buscar por nome do arquivo, ID ou tarefa" value="${esc(H.aQ)}">
      ${list.length ? `<ul class="list">${list.map(fileItem).join('')}</ul>` : `<p class="empty">${files.length ? 'Nenhum arquivo nesta gaveta/pasta.' : 'A estante está vazia. Os arquivos aparecem aqui quando alguém registra uma entrega real numa tarefa (enviando um arquivo ou escrevendo um texto).'}</p>`}
    </div></div>`;
}
const NOTIF_ICON = {atribuicao:'👤', inicio:'▶️', etapa:'✔️', revisao:'🔍', devolucao:'↩️', problema:'⚠️', tarefa:'✅', arquivo:'📁', arquivada:'🗄️'};
function hubNotifs(){
  const ns = Store.all('notifs').sort((a, b) => b.t - a.t), unread = ns.filter(n => !n.read).length;
  return ns.length ? `<div class="row" style="justify-content:space-between"><span class="meta">${unread} não lida${unread === 1 ? '' : 's'} de ${ns.length}</span><div class="row"><button class="btn sm" data-act="readall" type="button" ${unread ? '' : 'disabled'}>Marcar todas como lidas</button><button class="btn sm danger" data-act="clearnotifs" type="button">Limpar notificações</button></div></div>
    <ul class="list">${ns.map(n => `<li class="item ${n.read ? 'read' : 'unread'}">
      <div class="h"><b>${NOTIF_ICON[n.kind] || '🔔'} ${esc(n.txt)}</b><span class="mono">${fmt(n.t)}</span></div>
      ${n.to ? `<div class="meta">Para: ${n.to.map(id => esc(person(id).name)).join(' e ')}</div>` : ''}
      <div class="row">${n.taskId && Store.get('tasks', n.taskId) ? `<button class="btn sm" data-open="${n.taskId}" type="button">Abrir tarefa</button>` : ''}${n.fileId && Store.get('files', n.fileId) && Store.available(Store.get('files', n.fileId)) ? `<button class="btn sm" data-act="view" data-f="${n.fileId}" type="button">Abrir arquivo</button>` : ''}${n.read ? '<span class="meta">Lida</span>' : `<button class="btn sm" data-act="readone" data-n="${n.id}" type="button">Marcar como lida</button>`}</div></li>`).join('')}</ul>`
    : '<p class="empty">Nenhuma notificação. Elas aparecem quando uma tarefa é atribuída, uma etapa começa ou termina, a tarefa entra em revisão, é devolvida, tem problema, é concluída ou arquivada, e quando um arquivo é guardado.</p>';
}
function hubTeam(){
  const files = Store.all('files');
  const ids = ['gerente','secretaria','pesquisador','copywriter','criativo','analista','social','voce'];
  return `<ul class="list" style="grid-template-columns:repeat(auto-fit,minmax(270px,1fr))">${ids.map(id => {
    const p = person(id), a = byId[id], w = agentWork(id);
    const [lbl, cls] = a ? agentState(a) : (w.doing.length ? STATEL.trab : w.waiting.length ? STATEL.agu : STATEL.disp);
    const cur = w.doing[0] || w.waiting[0];
    return `<li class="item"><div class="h"><b>${p.emoji} ${esc(p.name)}</b><span class="pill"><span class="dot ${cls}"></span>${lbl}</span></div>
      <div class="meta">${esc(p.role)}</div>
      <div class="meta">Tarefa atual: ${cur ? `<a href="#" data-open="${cur.id}" style="color:var(--accent)">${esc(cur.code)} ${esc(cur.title)}</a> — ${esc(curStage(cur).label)} (${curStage(cur).status === 'andamento' ? 'fazendo' : 'aguardando'})` : 'nenhuma'}</div>
      <div class="meta mono">${w.pend.length} pendente${w.pend.length === 1 ? '' : 's'} · ${w.done.length} concluída${w.done.length === 1 ? '' : 's'} · ${w.stagesDone} etapa(s) · ${files.filter(f => f.resp === id).length} arquivo(s)</div>
      <div class="row"><button class="btn sm" data-act="agenttasks" data-a="${id}" type="button">Abrir tarefas</button>${a ? `<button class="btn sm" data-act="agent" data-a="${id}" type="button">Abrir ficha</button><button class="btn sm" data-act="goto" data-a="${id}" type="button">Ir até a mesa</button>` : ''}</div></li>`;
  }).join('')}</ul>`;
}
function hubReports(){
  const tasks = Store.all('tasks'), files = Store.all('files');
  if (!tasks.length && !files.length) return `<p class="empty">Ainda não há dados para relatórios. Os números aparecem assim que tarefas forem registradas.</p>${integrationsHtml()}`;
  const c = k => tasks.filter(t => taskStatus(t) === k).length;
  const doneToday = tasks.filter(t => t.doneAt && inPeriod(t.doneAt, 'hoje')).length, doneWeek = tasks.filter(t => t.doneAt && inPeriod(t.doneAt, 'semana')).length;
  const perStage = {}; tasks.forEach(t => t.stages.forEach(s => { if (s.startedAt && s.doneAt){ (perStage[s.key] = perStage[s.key] || []).push(s.doneAt - s.startedAt); } }));
  const byStage = {}; tasks.filter(isActive).forEach(t => { const k = curStage(t).key; byStage[k] = (byStage[k] || 0) + 1; });
  const ids = ['pesquisador','copywriter','criativo','gerente','social','analista','secretaria','voce'];
  const maxS = Math.max(1, ...Object.values(byStage));
  return `<div class="stats">
      <div class="stat"><span>Tarefas totais</span><b>${tasks.length}</b></div><div class="stat"><span>Não iniciadas</span><b>${c('nao')}</b></div><div class="stat"><span>Aguardando</span><b>${c('agu')}</b></div>
      <div class="stat"><span>Em andamento</span><b>${c('and')}</b></div><div class="stat"><span>Em revisão</span><b>${c('rev')}</b></div><div class="stat"><span>Com problema</span><b>${c('prob')}</b></div>
      <div class="stat"><span>Pausadas</span><b>${c('pau')}</b></div><div class="stat"><span>Concluídas</span><b>${c('ok')}</b></div><div class="stat"><span>Atrasadas</span><b>${tasks.filter(isLate).length}</b></div>
      <div class="stat"><span>Concluídas hoje</span><b>${doneToday}</b></div><div class="stat"><span>Concluídas esta semana</span><b>${doneWeek}</b></div><div class="stat"><span>Arquivos</span><b>${files.length}</b></div></div>
    <div class="grid2">
      <div><h4 class="sec">Tarefas por agente</h4><div class="tblwrap"><table class="tbl"><thead><tr><th>Agente</th><th>Fazendo</th><th>Aguard.</th><th>Pendentes</th><th>Concluídas</th><th>Etapas ✓</th></tr></thead><tbody>${ids.map(id => { const w = agentWork(id); return `<tr><td>${pName(id)}</td><td>${w.doing.length}</td><td>${w.waiting.length}</td><td>${w.pend.length}</td><td>${w.done.length}</td><td>${w.stagesDone}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div><h4 class="sec">Tarefas ativas por etapa atual</h4>${Object.keys(byStage).length ? `<ul class="list">${STAGE_ORDER.filter(k => byStage[k]).map(k => `<li><div class="meta" style="color:var(--fg)">${STAGES[k].label} <span class="mono">· ${byStage[k]}</span></div><div class="bar"><i style="width:${byStage[k]/maxS*100}%"></i></div></li>`).join('')}</ul>` : '<p class="meta">Nenhuma tarefa ativa.</p>'}</div>
      <div><h4 class="sec">Tempo médio por etapa (do início à conclusão)</h4>${Object.keys(perStage).length ? `<ul class="hist">${STAGE_ORDER.filter(k => perStage[k]).map(k => `<li><time>${dur(perStage[k].reduce((a, b) => a + b, 0)/perStage[k].length)}</time><span>${STAGES[k].label} (${perStage[k].length} registro${perStage[k].length > 1 ? 's' : ''})</span></li>`).join('')}</ul>` : '<p class="meta">Sem etapas com início e conclusão registrados.</p>'}</div>
      <div><h4 class="sec">Arquivos por tipo e período</h4><ul class="hist">${CATS.map(ct => `<li><time>${files.filter(f => f.cat === ct.id).length}</time><span>${ct.icon} ${ct.label}</span></li>`).join('')}${['hoje','semana','mes'].map(pid => `<li><time>${files.filter(f => inPeriod(f.createdAt, pid)).length}</time><span>${periodLabel(pid)}</span></li>`).join('')}</ul></div>
    </div>
    <div class="row"><button class="btn pri" data-act="report" type="button">Baixar relatório geral (.txt)</button><span class="meta">Resultados de anúncios (alcance, cliques, custo) não aparecem aqui porque o Meta Ads não está conectado.</span></div>
    ${integrationsHtml()}`;
}
function integrationsHtml(){
  const I = window.EVIntegracoes;
  const L = I ? [...Object.values(I.ia.provedores), ...Object.values(I.canais)] : [];
  return `<div><h4 class="sec">Integrações</h4><p class="meta">Nenhuma integração externa está conectada. A camada de integrações fica separada (arquivo js/integracoes.js) e as ações do escritório também estão disponíveis em window.EscritorioVirtual, para serem ligadas no futuro.</p><div class="chips">${L.map(x => `<span class="chip" style="cursor:default">${esc(x.nome)} · ${x.conectado ? 'conectado' : 'não conectado'}</span>`).join('')}</div></div>`;
}
function reportText(){
  const tasks = Store.all('tasks').sort((a, b) => a.createdAt - b.createdAt), files = Store.all('files');
  const L = [`RELATÓRIO DO ESCRITÓRIO VIRTUAL DE MARKETING`, `Gerado em ${fmtFull(now())} a partir dos dados registrados na Central de Tarefas.`, '', officeSummary(), '', 'TAREFAS'];
  tasks.forEach(t => { L.push('', `${t.code} ${t.title} — ${TSTATUS[taskStatus(t)][0]} (${Math.round(taskProgress(t)*100)}%) — prioridade ${PRIORITIES[t.priority][0]}${t.due ? ' — prazo ' + fmtDate(t.due) : ''}`); t.stages.forEach((s, i) => L.push(`  ${i+1}. ${s.label} — ${person(s.resp).name} — ${STAGE_STATE_L[stageState(t, i)]}${s.startedAt ? ' — início ' + fmtFull(s.startedAt) : ''}${s.doneAt ? ' — conclusão ' + fmtFull(s.doneAt) : ''}`)); });
  L.push('', `ARQUIVOS NA ESTANTE (${files.length})`); files.sort((a, b) => a.createdAt - b.createdAt).forEach(f => L.push(`  ${fmtFull(f.createdAt)} — ${f.name} — ${(catById[f.cat]||catById.outros).label} — tarefa: ${f.taskTitle} — ${locationOf(f)}`));
  return L.join('\n');
}
function taskReportText(t){
  const files = Store.all('files').filter(f => f.taskId === t.id);
  const L = [`RELATÓRIO DA TAREFA ${t.code}: ${t.title}`, `Gerado em ${fmtFull(now())} a partir do histórico registrado.`, '', `Tipo: ${typeLabel(t.type)} · Prioridade: ${PRIORITIES[t.priority][0]} · Prazo: ${t.due ? fmtDate(t.due) : '—'}`, `Status: ${TSTATUS[taskStatus(t)][0]} (${Math.round(taskProgress(t)*100)}%)`, `Criada: ${fmtFull(t.createdAt)} · Início: ${fmtFull(t.startedAt)} · Conclusão: ${fmtFull(t.doneAt)}`, t.desc ? `Descrição: ${t.desc}` : '', '', 'ETAPAS'];
  t.stages.forEach((s, i) => L.push(`  ${i+1}. ${s.label} — ${person(s.resp).name} — ${STAGE_STATE_L[stageState(t, i)]}${s.startedAt && s.doneAt ? ' — duração ' + dur(s.doneAt - s.startedAt) : ''}`));
  L.push('', `ARQUIVOS (${files.length})`); files.forEach(f => L.push(`  ${f.name} — ${fmtFull(f.createdAt)} — ${locationOf(f)}`));
  L.push('', 'HISTÓRICO'); (t.history || []).forEach(h => L.push(`  ${fmtFull(h.t)} — ${h.txt}`));
  if (t.notes) L.push('', 'OBSERVAÇÕES', t.notes);
  return L.join('\n');
}

/* ---------- Diálogos ---------- */
function openDlg(title, html){ $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = html; $('#dlgWrap').hidden = false; setTimeout(() => { const f = $('#dlgBody').querySelector('input,textarea,select'); f && f.focus(); }, 30); }
function closeDlg(){ $('#dlgWrap').hidden = true; $('#dlgBody').innerHTML = ''; }
$('#dlgClose').addEventListener('click', closeDlg);
$('#dlgWrap').addEventListener('click', e => { if (e.target.id === 'dlgWrap') closeDlg(); });
function respSelect(id, sel, extra){ return `<select id="${id}" ${extra || ''}>${RESP_IDS.map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${person(r).name} — ${person(r).role}</option>`).join('')}</select>`; }
/* Editor de fluxo: padrão (9 etapas na ordem oficial) ou personalizado (escolher, reordenar e trocar responsáveis) */
function flowRows(order, checked){
  return order.map(k => `<div class="se" data-key="${k}"><input type="checkbox" id="st_${k}" ${checked.includes(k) ? 'checked' : ''}><label for="st_${k}">${STAGES[k].label}</label>
    <span class="row" style="gap:4px;flex-wrap:nowrap">${respSelect('sr_' + k, defaultResp(k), 'class="inl"')}<button class="btn sm" type="button" data-mv="-1" aria-label="Subir ${STAGES[k].label}">↑</button><button class="btn sm" type="button" data-mv="1" aria-label="Descer ${STAGES[k].label}">↓</button></span></div>`).join('');
}
function openNewTask(prefill){
  if (!Store.ready){ toast('Aguarde: conectando ao armazenamento…'); return; }
  if (Store.readOnly){ toast('Você só tem permissão de leitura.'); return; }
  openDlg('Dar ordem a Marcos', `<form id="fNew" style="display:grid;gap:12px">
    <div class="note"><b>Você só precisa dizer o que quer.</b><br>Marcos escolhe o fluxo, distribui para a equipe e acompanha tudo automaticamente.</div>
    <label class="f">O que você quer que o escritório produza?<textarea class="f" id="nDesc" required style="min-height:150px" placeholder="Ex.: Quero um criativo de salário-maternidade para gestantes de 7 a 9 meses, para Instagram.">${esc(prefill || '')}</textarea></label>
    <div class="grid2" style="gap:10px">
      <label class="f">Prioridade<select id="nPrio">${Object.entries(PRIORITIES).map(([k,[l]]) => `<option value="${k}" ${k==='media'?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="f">Prazo<input type="date" id="nDue"></label>
    </div>
    <div class="meta">O tipo e as etapas serão definidos automaticamente a partir do seu pedido. A publicação em Instagram/Facebook/TikTok <b>não será feita</b>.</div>
    <div class="row"><button class="btn pri" type="submit">ENTREGAR A MARCOS</button><button class="btn" type="button" data-act="closedlg">Cancelar</button></div>
  </form>`);
  $('#fNew').addEventListener('submit', async e => {
    e.preventDefault();
    const order = $('#nDesc').value.trim(); if (!order) return;
    const type = inferOrderType(order), stages = autoStagesFor(type);
    const title = order.length > 100 ? order.slice(0,97) + '…' : order;
    const t = createTask({title, desc:order, type, priority:$('#nPrio').value, due:$('#nDue').value, notes:'Ordem recebida por Marcos. Execução automática ativada.', stages});
    closeDlg();
    toast(`Marcos recebeu a ordem ${t.code}. A equipe começou a trabalhar.`);
    openHub('task', t.id);
    runTaskAutomation(t.id);
  });
}

function openDeliver(taskId){
  if (!Store.ready){ toast('Aguarde: conectando ao armazenamento…'); return; }
  const tasks = Store.all('tasks').sort((a, b) => (isActive(b) - isActive(a)) || (b.createdAt - a.createdAt));
  if (!tasks.length){ toast('Crie uma tarefa antes: todo arquivo precisa estar ligado a uma tarefa.'); return; }
  const t0 = Store.get('tasks', taskId) || tasks[0];
  const stOpts = t => t.stages.map((s, i) => `<option value="${i}" ${i === (curStage(t) ? t.cur : t.stages.length - 1) ? 'selected' : ''}>${s.label} (${person(s.resp).name})</option>`).join('');
  const sd = t0.stages[t0.cur] || t0.stages[t0.stages.length - 1];
  openDlg('Registrar entrega / guardar arquivo', `<form id="fDel" style="display:grid;gap:12px">
    <label class="f">Tarefa<select id="dTask">${tasks.map(t => `<option value="${t.id}" ${t.id === t0.id ? 'selected' : ''}>${esc(t.code)} · ${esc(t.title)}</option>`).join('')}</select></label>
    <div class="grid2" style="gap:10px"><label class="f">Etapa<select id="dStage">${stOpts(t0)}</select></label>
    <label class="f">Pasta (tipo)<select id="dCat">${CATS.map(c => `<option value="${c.id}" ${c.id === STAGES[sd.key].cat ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label></div>
    <label class="f">Responsável pela entrega${respSelect('dResp', sd.resp)}</label>
    <div class="chips" role="group"><button class="chip" type="button" data-mode="file" aria-pressed="true">Enviar arquivo</button><button class="chip" type="button" data-mode="text" aria-pressed="false">Escrever texto</button></div>
    <div id="dFileBox"><label class="f">Arquivo(s)<input type="file" id="dFiles" multiple></label><div class="note">Vídeos, imagens, PDF, textos… O arquivo é guardado neste navegador e fica ligado à tarefa.</div></div>
    <div id="dTextBox" hidden style="display:grid;gap:10px">
      <label class="f">Modelo<select id="dModel">${Object.entries(DOC_MODELS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}</select></label>
      <label class="f">Nome do arquivo<input type="text" id="dName" placeholder="copy_salario_maternidade_01"></label>
      <label class="f">Conteúdo<textarea class="f" id="dText" style="min-height:180px" placeholder="Cole ou escreva o texto, roteiro, copy, briefing ou relatório"></textarea></label>
      <div class="note">O modelo só traz os títulos das seções; o conteúdo é o que você escrever. Será salvo como arquivo .txt de verdade na estante.</div></div>
    <div class="row"><button class="btn pri" type="submit" id="dSave">Guardar na estante</button><button class="btn" type="button" data-act="closedlg">Cancelar</button></div>
  </form>`);
  let mode = 'file', lastScaffold = '';
  const curTask = () => Store.get('tasks', $('#dTask').value);
  const upd = () => { $('#dStage').innerHTML = stOpts(curTask()); updStage(); };
  const updStage = () => { const t = curTask(), s = t.stages[+$('#dStage').value]; $('#dCat').value = STAGES[s.key].cat; $('#dResp').value = s.resp; };
  const applyModel = () => {
    const m = DOC_MODELS[$('#dModel').value], t = curTask(), box = $('#dText');
    if (!box.value.trim() || box.value === lastScaffold){ lastScaffold = m.body(t.title); box.value = lastScaffold; }
    if (m.cat) $('#dCat').value = m.cat;
    if (!$('#dName').value.trim() || /^(texto|copy|roteiro|briefing|relatorio)_/.test($('#dName').value)) $('#dName').value = `${m.prefix}_${norm(t.code + '_' + t.title).replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
  };
  $('#dTask').addEventListener('change', upd); $('#dStage').addEventListener('change', updStage); $('#dModel').addEventListener('change', applyModel);
  $('#dFiles').addEventListener('change', e => { const f = e.target.files[0]; const g = f && guessCat(f); if (g) $('#dCat').value = g; });
  $('#fDel').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode; $('#fDel').querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#dFileBox').hidden = mode !== 'file'; $('#dTextBox').hidden = mode !== 'text'; $('#dTextBox').style.display = mode === 'text' ? 'grid' : 'none';
    if (mode === 'text' && !$('#dName').value) applyModel();
  }));
  $('#dTextBox').style.display = 'none';
  $('#fDel').addEventListener('submit', async e => {
    e.preventDefault();
    let list = [];
    if (mode === 'file'){ list = [...$('#dFiles').files].map(f => ({blob: f, name: f.name})); if (!list.length){ toast('Escolha pelo menos um arquivo.'); return; } }
    else {
      const txt = $('#dText').value; if (!txt.trim() || txt === lastScaffold){ toast('Escreva o conteúdo do texto.'); return; }
      let nm = ($('#dName').value.trim() || 'texto_' + new Date().toISOString().slice(0, 10)).replace(/[\\/:*?"<>|]+/g, '_');
      if (!/\.(txt|md)$/i.test(nm)) nm += '.txt';
      list = [{blob: new Blob([txt], {type:'text/plain'}), name: nm}];
    }
    const btn = $('#dSave'); btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const res = await attachFiles($('#dTask').value, +$('#dStage').value, list, $('#dCat').value, $('#dResp').value, mode === 'file' ? 'upload' : 'texto');
      closeDlg(); toast(res.length > 1 ? `${res.length} arquivos guardados na estante.` : `Arquivo guardado: ${locationOf(res[0])}`);
      if (H.view) renderHub();
    } catch (err){ console.warn(err); btn.disabled = false; btn.textContent = 'Guardar na estante'; toast('Não foi possível guardar o arquivo.'); }
  });
}
function openNoteDlg(title, label, btnLabel, onOk, opts = {}){
  openDlg(title, `<form id="fNote" style="display:grid;gap:12px">${opts.before || ''}<label class="f">${label}<textarea class="f" id="nNote" ${opts.required ? 'required' : ''}></textarea></label>
    <div class="row"><button class="btn ${opts.danger ? 'danger' : 'pri'}" type="submit">${btnLabel}</button><button class="btn" type="button" data-act="closedlg">Cancelar</button></div></form>`);
  $('#fNote').addEventListener('submit', e => { e.preventDefault(); const v = $('#nNote').value.trim(); if (opts.required && !v){ toast('Informe o motivo.'); return; } onOk(v); closeDlg(); });
}
async function openViewer(fid){
  const f = Store.get('files', fid); if (!f) return;
  const cat = catById[f.cat] || catById.outros;
  openDlg(f.name, `<div class="viewer" id="vBox"><p class="meta">Carregando…</p></div>
    <dl class="kv"><dt>Tipo</dt><dd>${cat.icon} ${cat.label}</dd><dt>Data</dt><dd>${fmtFull(f.createdAt)}</dd><dt>Tamanho</dt><dd>${fmtSize(f.size) || '—'}</dd><dt>Tarefa</dt><dd>${esc((f.taskCode ? f.taskCode + ' ' : '') + f.taskTitle)}</dd><dt>Etapa</dt><dd>${f.stageKey && STAGES[f.stageKey] ? STAGES[f.stageKey].label : '—'}</dd><dt>Responsável</dt><dd>${pName(f.resp)}</dd><dt>Local</dt><dd>${esc(locationOf(f))}</dd></dl>
    <div class="row"><button class="btn pri" data-act="dl" data-f="${f.id}" type="button">Baixar</button></div>`);
  const box = $('#vBox'), m = f.mime || '', e = (f.name.split('.').pop() || '').toLowerCase();
  try {
    let url = Store.viewUrl(f);
    if (!url){ const b = await Store.getBlob(f); url = URL.createObjectURL(b); setTimeout(() => URL.revokeObjectURL(url), 600000); }
    if (m.startsWith('image/')) box.innerHTML = `<img src="${url}" alt="${esc(f.name)}">`;
    else if (m.startsWith('video/') || ['mp4','webm','mov'].includes(e)) box.innerHTML = `<video src="${url}" controls playsinline></video>`;
    else if (m.startsWith('audio/')) box.innerHTML = `<audio src="${url}" controls></audio>`;
    else if (m === 'application/pdf' || e === 'pdf') box.innerHTML = `<iframe src="${url}" title="${esc(f.name)}"></iframe><p class="meta">Se a pré-visualização não aparecer, use Baixar.</p>`;
    else if (m.startsWith('text/') || ['txt','md','csv','json'].includes(e)){ const b = await Store.getBlob(f); const txt = await b.text(); box.innerHTML = `<pre>${esc(txt)}</pre>`; }
    else box.innerHTML = `<p class="meta">Este formato não tem pré-visualização aqui. Use Baixar para abrir no seu computador.</p>`;
  } catch (err){ box.innerHTML = `<p class="warnbox">Arquivo ainda não disponível neste aparelho.</p>`; }
}
/* ---------- Backup ---------- */
function openExport(){
  const nf = Store.all('files').length;
  openDlg('Exportar dados', `<div class="meta" style="color:var(--fg)">Gera um arquivo .json com todas as tarefas (com histórico), notificações, arquivos da estante e configurações.</div>
    <label class="row" style="gap:8px;font-size:13px"><input type="checkbox" id="xContent" checked> Incluir o conteúdo dos arquivos (${nf} arquivo${nf === 1 ? '' : 's'}) — backup completo, arquivo maior</label>
    <div class="row"><button class="btn pri" id="xGo" type="button">Baixar backup (.json)</button><button class="btn" type="button" data-act="closedlg">Cancelar</button></div><p class="meta" id="xMsg"></p>`);
  $('#xGo').addEventListener('click', async () => {
    const b = $('#xGo'); b.disabled = true; b.textContent = 'Preparando…';
    try {
      const {data, skipped} = await exportData($('#xContent').checked);
      const name = `backup_escritorio_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      const r = await Store.downloadText(name, JSON.stringify(data, null, 1));
      $('#xMsg').textContent = (r === 'saved' ? `Backup gerado: ${name}.` : 'Download cancelado.') + (skipped ? ` ${skipped} arquivo(s) sem conteúdo disponível neste navegador foram exportados só com os dados (metadados).` : '');
    } catch (e){ $('#xMsg').textContent = 'Não foi possível gerar o backup: ' + (e.message || e); }
    b.disabled = false; b.textContent = 'Baixar backup (.json)';
  });
}
function openImport(){
  openDlg('Importar backup', `<label class="f">Arquivo de backup (.json)<input type="file" id="iFile" accept=".json,application/json"></label><div id="iInfo"></div>`);
  $('#iFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    let obj, info;
    try { obj = JSON.parse(await f.text()); info = readBackup(obj); }
    catch (err){ $('#iInfo').innerHTML = `<p class="warnbox">${esc(err.message && err.message.includes('backup') ? err.message : 'Arquivo inválido: não é um backup do Escritório Virtual.')}</p>`; return; }
    const cur = Store.all('tasks').length;
    $('#iInfo').innerHTML = `<div class="item"><b>Conteúdo do backup</b><div class="meta">${info.tasks} tarefa(s), ${info.files} arquivo(s) (${info.withContent} com conteúdo), ${info.notifs} notificação(ões). Exportado em ${info.exportedAt ? fmtFull(Date.parse(info.exportedAt)) : '—'}.</div></div>
      <p class="meta">Hoje existem ${cur} tarefa(s) neste navegador.</p>
      <div class="row"><button class="btn pri" id="iMerge" type="button">Mesclar com os dados atuais</button><button class="btn danger" id="iReplace" type="button">Substituir todos os dados atuais</button></div>
      <p class="meta">Mesclar mantém o que já existe e acrescenta/atualiza pelo ID. Substituir apaga os dados atuais antes de restaurar (pede confirmação).</p><p class="meta" id="iMsg"></p>`;
    const run = async mode => {
      $('#iMsg').textContent = 'Importando…';
      try { await importData(obj, mode); closeDlg(); toast(`Backup importado (${mode === 'substituir' ? 'substituindo os dados' : 'mesclado'}).`); if (H.view) renderHub(); syncArchive(); }
      catch (err){ $('#iMsg').textContent = 'Falha ao importar: ' + (err.message || err); }
    };
    $('#iMerge').addEventListener('click', e2 => confirmInline(e2.currentTarget, 'Confirmar mesclagem', () => run('mesclar'), 20000));
    $('#iReplace').addEventListener('click', e2 => confirmInline(e2.currentTarget, 'Confirmar: apagar dados atuais e restaurar', () => run('substituir'), 20000));
  });
}

/* ---------- Ações de clique (delegação) ---------- */
function confirmInline(btn, label, fn, ms = 8000){
  if (btn.dataset.armed){ delete btn.dataset.armed; fn(); return; }
  btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = old; } }, ms);
}
document.addEventListener('click', async e => {
  const open = e.target.closest('[data-open]'), act = e.target.closest('[data-act]');
  if (act){
    e.preventDefault(); e.stopPropagation();
    const a = act.dataset.act, tid = act.dataset.t, fid = act.dataset.f;
    const safeAct = ['view','dl','back','closedlg','agent','goto','report','agenttasks','export'].includes(a);
    if (!Store.ready && !safeAct){ toast('Aguarde: conectando ao armazenamento…'); return; }
    if (Store.readOnly && !safeAct){ toast('Você só tem permissão de leitura.'); return; }
    if (a === 'newtask') openNewTask();
    else if (a === 'start'){
      const t = Store.get('tasks', tid), s = t && curStage(t);
      if (!startStage(tid)) { toast('Não foi possível iniciar esta etapa.'); return; }
      toast(s ? `${s.label} iniciada manualmente.` : 'Etapa iniciada.');
      if (s && AI_AUTO_STAGES.has(s.key)) executeAutoStage(tid).catch(err => toast(`Erro na execução: ${err.message || err}`));
    }
    else if (a === 'complete'){ const t = Store.get('tasks', tid), s = t && curStage(t), nf = Store.all('files').filter(f => f.taskId === tid && f.stageKey === s.key).length, nx = nextStage(t);
      openNoteDlg(s.key === 'revisao' ? 'Concluir revisão' : `Concluir ${s.label}`, `Observação da conclusão (opcional)${nf ? '' : ' — nenhum arquivo foi guardado nesta etapa'}`, 'Confirmar conclusão',
        note => { completeStage(tid, note); toast(nx ? `${STAGES[s.key].done}. ${nx.label} aguardando ${person(nx.resp).name}.` : 'Tarefa concluída.'); },
        {before: `<p class="meta">${nx ? `Próxima etapa: <b>${esc(nx.label)}</b> com ${pName(nx.resp)}.` : 'Esta é a última etapa: a tarefa será concluída.'}</p>`}); }
    else if (a === 'return'){ const t = Store.get('tasks', tid);
      const opts = t.stages.slice(0, t.cur).map((x, i) => `<option value="${i}" ${i === t.cur - 1 ? 'selected' : ''}>${x.label} (${person(x.resp).name})</option>`).join('');
      openNoteDlg('Devolver para ajustes', 'Motivo do ajuste', 'Devolver', note => { returnStage(tid, note, +$('#rTo').value); toast('Tarefa devolvida para ajustes.'); },
        {required: true, before: `<label class="f">Devolver para a etapa<select id="rTo">${opts}</select></label>`}); }
    else if (a === 'deliver') openDeliver(tid || (H.view === 'task' ? H.taskId : null));
    else if (a === 'pause') openNoteDlg('Pausar tarefa', 'Motivo (opcional)', 'Pausar', note => { setHold(tid, 'pausada', note); toast('Tarefa pausada.'); });
    else if (a === 'problem') openNoteDlg('Marcar problema', 'Motivo do problema', 'Marcar problema', note => { setHold(tid, 'problema', note, $('#pWho').value); toast('Problema registrado. Gerente e Secretária notificados.'); },
      {danger: true, required: true, before: `<label class="f">Quem identificou${respSelect('pWho', 'voce')}</label>`});
    else if (a === 'resume'){ setHold(tid, null); toast('Tarefa retomada.'); }
    else if (a === 'savenotes'){ setNotes(tid, $('#tNotes').value); toast('Observações salvas.'); }
    else if (a === 'addnote'){ const v = $('#tNewNote').value.trim(); if (!v){ toast('Escreva a observação.'); return; } addNote(tid, v); toast('Observação registrada no histórico.'); }
    else if (a === 'deltask') confirmInline(act, 'Clique de novo para excluir', () => { deleteTask(tid); toast('Tarefa excluída.'); openHub(H.prev || 'tarefas'); });
    else if (a === 'delfile') confirmInline(act, 'Confirmar exclusão', async () => { await deleteFile(fid); toast('Arquivo excluído.'); if (!$('#dlgWrap').hidden) closeDlg(); });
    else if (a === 'view') openViewer(fid);
    else if (a === 'dl'){ const f = Store.get('files', fid); try { const r = await Store.download(f); if (r === 'saved') toast('Download iniciado.'); } catch (err){ toast(err.message || 'Arquivo ainda não disponível.'); } }
    else if (a === 'back') openHub(H.prev || 'tarefas');
    else if (a === 'closedlg') closeDlg();
    else if (a === 'agent') openAgent(byId[act.dataset.a]);
    else if (a === 'goto') gotoAgent(byId[act.dataset.a]);
    else if (a === 'agenttasks'){ H.tResp = act.dataset.a; H.tFilter = 'todas'; H.tQ = ''; openHub('tarefas'); }
    else if (a === 'readone'){ markRead([act.dataset.n]); }
    else if (a === 'readall'){ markRead(); toast('Todas marcadas como lidas.'); }
    else if (a === 'clearnotifs') confirmInline(act, 'Confirmar limpeza', () => { Store.all('notifs').forEach(n => Store.del('notifs', n.id)); toast('Notificações apagadas.'); });
    else if (a === 'export') openExport();
    else if (a === 'import') openImport();
    else if (a === 'report'){ try { await Store.downloadText(`relatorio_escritorio_${new Date().toISOString().slice(0, 10)}.txt`, reportText()); } catch (err){ toast(err.message); } }
    else if (a === 'taskreport'){ const t = Store.get('tasks', tid); const s = t.stages.findIndex(x => x.key === 'analise'); const idx = s >= 0 ? s : Math.min(t.cur, t.stages.length - 1);
      const res = await attachFiles(tid, idx, [{blob: new Blob([taskReportText(t)], {type:'text/plain'}), name: `relatorio_${norm(t.code + '_' + t.title).replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.txt`}], 'relatorios', 'analista', 'relatorio');
      toast(`Relatório guardado: ${locationOf(res[0])}`); }
    return;
  }
  if (open && !e.target.closest('select,input,textarea,button:not([data-open])')){ e.preventDefault(); if (!$('#dlgWrap').hidden) closeDlg(); openHub('task', open.dataset.open); return; }
  const ch = e.target.closest('[data-tf],[data-per],[data-cat],[data-ask],[data-hub-go]');
  if (!ch) return;
  if (ch.dataset.tf){ H.tFilter = ch.dataset.tf; renderHub(); }
  else if (ch.dataset.per){ H.aPer = ch.dataset.per; renderHub(); }
  else if (ch.dataset.cat !== undefined && ch.closest('#hbody')){ H.aCat = ch.dataset.cat; renderHub(); }
  else if (ch.dataset.ask) ask(ch.dataset.ask);
  else if (ch.dataset.hubGo) openHub(ch.dataset.hubGo);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'tResp'){ H.tResp = el.value; renderHub(); return; }
  if (!Store.ready || Store.readOnly) return;
  if (el.dataset && el.dataset.resp !== undefined){ setResp(el.dataset.t, +el.dataset.resp, el.value); toast('Responsável alterado e registrado no histórico.'); }
  if (el.dataset && el.dataset.field){ setTaskField(el.dataset.t, el.dataset.field, el.value); toast(el.dataset.field === 'due' ? 'Prazo alterado.' : 'Prioridade alterada.'); }
  if (el.dataset && el.dataset.defresp){ setDefaultResp(el.dataset.defresp, el.value); toast(`Responsável padrão por ${STAGES[el.dataset.defresp].label}: ${person(el.value).name}.`); }
  if (el.dataset && (el.dataset.resp !== undefined || el.dataset.field || el.dataset.defresp)){ el.blur(); if (H.view) renderHub(); if (panelAgent) renderPanel(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'tQ'){ H.tQ = e.target.value; rerenderKeepFocus('tQ'); }
  if (e.target.id === 'aQ'){ H.aQ = e.target.value; rerenderKeepFocus('aQ'); }
});
function rerenderKeepFocus(id){ const el = $('#' + id), pos = el.selectionStart; renderHub(); const n = $('#' + id); if (n){ n.focus(); n.setSelectionRange(pos, pos); } }

/* =====================================================================
   JOGADOR, CONTROLES, PROXIMIDADE E CÂMERA
   ===================================================================== */
const player = makeCharacter({skin:'#d8a386', shirt:'#2f6f73', pants:'#343a46', hair:'#2a211c'});
player.root.position.set(0, 0, 3.2);
let yaw = Math.PI, speed = 0, turnRate = 0;
scene.add(player.root);
const blob = new THREE.Mesh(new THREE.CircleGeometry(.42, 24), new THREE.MeshBasicMaterial({color:'#000', transparent:true, opacity:.22, depthWrite:false}));
blob.rotation.x = -Math.PI/2; blob.position.y = .01; scene.add(blob);
const PR = .34;
function blocked(x, z){
  if (x < -W/2 + .4 || x > W/2 - .4 || z < -D/2 + .4 || z > D/2 - .4) return true;
  for (const o of obstacles){
    const cx = clamp(x, o.minx, o.maxx), cz = clamp(z, o.minz, o.maxz);
    if ((x-cx)**2 + (z-cz)**2 < PR*PR) return true;
  }
  return false;
}
const keys = new Set();
const KEYMAP = {ArrowUp:'f', KeyW:'f', ArrowDown:'b', KeyS:'b', ArrowLeft:'l', KeyA:'l', ArrowRight:'r', KeyD:'r'};
const typing = () => { const el = document.activeElement; return el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT'); };
const uiOpen = () => !$('#dlgWrap').hidden;
addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    if (!$('#dlgWrap').hidden) closeDlg(); else if (!$('#hub').hidden) closeHub(); else if (panelAgent){ closePanel(); canvas.focus(); }
    return;
  }
  if (typing() || uiOpen()) return;
  if (KEYMAP[e.code]){ keys.add(KEYMAP[e.code]); e.preventDefault(); }
  if (e.code === 'KeyE' && nearAgent && !e.repeat){ openAgent(nearAgent); e.preventDefault(); }
  if (e.code === 'KeyC' && !e.repeat){ overview = !overview; syncMenu(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
addEventListener('blur', () => keys.clear());
document.querySelectorAll('#pad button').forEach(b => {
  const k = KEYMAP[b.dataset.k];
  b.addEventListener('pointerdown', e => { keys.add(k); b.setPointerCapture(e.pointerId); e.preventDefault(); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev => b.addEventListener(ev, () => keys.delete(k)));
});
let camDist = 6.2;
canvas.addEventListener('wheel', e => { camDist = clamp(camDist + Math.sign(e.deltaY)*.6, 3.6, 11); e.preventDefault(); }, {passive:false});
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function pick(e){
  const r = canvas.getBoundingClientRect();
  mouse.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(agentMeshes, false).concat(ray.intersectObject(ARCH.group, true)).sort((a, b) => a.distance - b.distance);
  const h = hits[0]; if (!h) return null;
  return h.object.userData.agentId === 'arquivo' || isArchMesh(h.object) ? ARCH : byId[h.object.userData.agentId];
}
function isArchMesh(o){ while (o){ if (o === ARCH.group) return true; o = o.parent; } return false; }
canvas.addEventListener('pointermove', e => { canvas.style.cursor = pick(e) ? 'pointer' : 'default'; });
canvas.addEventListener('click', e => {
  canvas.focus();
  const a = pick(e); if (!a) return;
  if (distTo(a) <= INTERACT) openAgent(a);
  else toast(`Chegue mais perto de ${a.isArchive ? 'da estante' : a.name} para interagir.`);
});
$('#promptBtn').addEventListener('click', () => nearAgent && openAgent(nearAgent));

const INTERACT = 2.7;
const tmpV = new THREE.Vector3();
const ARCH_POS = new THREE.Vector3(0, 1, 6.62);
function worldOf(a){ return a.isArchive ? ARCH_POS : a.char.hips.getWorldPosition(tmpV); }
function distTo(a){ const p = worldOf(a); return Math.hypot(p.x - player.root.position.x, p.z - player.root.position.z) - (a.isArchive ? .6 : 0); }
let nearAgent = null;
const INTERACTABLES = AGENTS.concat([ARCH]);
function gotoAgent(a){
  if (!a) return;
  const p = new THREE.Vector3(0, 0, -1.35); a.group.localToWorld(p);
  if (blocked(p.x, p.z)){ openAgent(a); return; }
  player.root.position.set(p.x, 0, p.z);
  const w = worldOf(a); yaw = Math.atan2(w.x - p.x, w.z - p.z); camYaw = yaw;
  closeHub(); updateCamera(0, true); toast(`Você está na mesa de ${a.name}. Pressione E para interagir.`);
}

/* rótulos */
const tagWrap = $('#tags');
INTERACTABLES.forEach(a => {
  const el = document.createElement('div'); el.className = 'tag' + (a.isArchive ? ' arch' : '');
  el.innerHTML = a.isArchive ? `📁 Estante / Arquivo <small id="archTagN"></small>` : `<span class="dot"></span>${a.emoji} ${a.name} <small>${a.tagRole || a.role.split(' (')[0]}</small>`;
  tagWrap.appendChild(el); a.tag = el; a.dot = el.querySelector('.dot');
});

/* =====================================================================
   O ESCRITÓRIO 3D REFLETE OS DADOS REAIS
   ===================================================================== */
function syncAgents(){
  const all = Store.all('tasks').filter(isActive), act = all.filter(t => !t.hold);
  AGENTS.forEach(a => {
    const mine = act.filter(t => curStage(t).resp === a.id);
    let st = mine.some(t => curStage(t).status === 'andamento' && curStage(t).key === 'revisao') ? 'rev'
      : mine.some(t => curStage(t).status === 'andamento') ? 'trab'
      : mine.some(t => curStage(t).status === 'aguardando') ? 'agu'
      : all.some(t => t.hold && curStage(t).resp === a.id) ? 'pau' : 'disp';
    if (a.id === 'gerente' && st === 'disp' && act.length) st = 'coord';
    a.state = st;
  });
}
function updateBoard(){
  const {ctx:g, c} = boardTex.userData, w = c.width, h = c.height;
  g.fillStyle = '#fbfbf8'; g.fillRect(0,0,w,h);
  g.fillStyle = '#1f3b6e'; g.font = '700 32px sans-serif'; g.fillText('TAREFAS ATIVAS', 30, 52);
  const act = Store.all('tasks').filter(isActive).sort((a, b) => a.createdAt - b.createdAt);
  g.font = '22px sans-serif';
  if (!act.length){ g.fillStyle = '#5b6780'; g.fillText('Nenhuma tarefa ativa na Central.', 30, 100); }
  act.slice(0, 7).forEach((t, i) => {
    const y = 96 + i*42, s = curStage(t), p = taskProgress(t);
    g.fillStyle = t.hold === 'problema' ? '#b3261e' : '#23324d';
    const title = t.title.length > 30 ? t.title.slice(0, 29) + '…' : t.title;
    g.fillText(title, 30, y);
    g.fillStyle = '#6b7488'; g.font = '17px sans-serif';
    g.fillText(t.hold ? (t.hold === 'pausada' ? 'Pausada' : 'Problema') : `${s.label} · ${person(s.resp).name}`, 30, y + 20);
    g.fillStyle = '#e4e7ee'; g.fillRect(430, y - 14, 170, 12); g.fillStyle = '#1e8a54'; g.fillRect(430, y - 14, 170*p, 12);
    g.font = '22px sans-serif';
  });
  if (act.length > 7){ g.fillStyle = '#5b6780'; g.fillText(`+ ${act.length - 7} na Central de Tarefas`, 30, 392); }
  boardTex.needsUpdate = true;
}
function drawTV(){
  const {ctx:g, c} = tvTex.userData, w = c.width, h = c.height;
  const tasks = Store.all('tasks'), files = Store.all('files'), cnt = k => tasks.filter(t => taskStatus(t) === k).length;
  g.fillStyle = '#0f1726'; g.fillRect(0,0,w,h);
  g.fillStyle = '#9aa6b8'; g.font = '600 16px sans-serif'; g.fillText('CENTRAL DE TAREFAS · DADOS REGISTRADOS', 20, 30);
  const kp = [['Ativas', tasks.filter(isActive).length], ['Concluídas', cnt('ok')], ['Arquivos', files.length]];
  kp.forEach(([k,v],i) => { g.fillStyle = '#9aa6b8'; g.font = '13px sans-serif'; g.fillText(k, 20 + i*165, 62); g.fillStyle = '#eef1f5'; g.font = '700 30px sans-serif'; g.fillText(String(v), 20 + i*165, 96); });
  const bars = [['Em andamento', cnt('and'), '#f2b64a'], ['Aguardando', cnt('agu') + cnt('nao'), '#8fb3ff'], ['Em revisão', cnt('rev'), '#c49cff'], ['Problema', cnt('prob'), '#e8606a'], ['Pausadas', cnt('pau'), '#8d97a8']];
  const mx = Math.max(1, ...bars.map(b => b[1]));
  bars.forEach(([l, n, col], i) => {
    const y = 128 + i*30;
    g.fillStyle = '#9aa6b8'; g.font = '14px sans-serif'; g.fillText(l, 20, y + 13);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(150, y, 300, 16);
    g.fillStyle = col; g.fillRect(150, y, 300 * n / mx, 16);
    g.fillStyle = '#eef1f5'; g.font = '600 14px sans-serif'; g.fillText(String(n), 462, y + 13);
  });
  tvTex.needsUpdate = true;
}
function syncArchive(){
  const files = Store.all('files'), cc = {};
  files.forEach(f => cc[f.cat] = (cc[f.cat] || 0) + 1);
  const pc = {hoje: 0, semana: 0, mes: 0, todos: files.length};
  files.forEach(f => { if (inPeriod(f.createdAt, 'hoje')) pc.hoje++; if (inPeriod(f.createdAt, 'semana')) pc.semana++; if (inPeriod(f.createdAt, 'mes')) pc.mes++; });
  paintArchive(cc, pc, CATS); ARCH.op = -1;
  const n = $('#archTagN'); if (n) n.textContent = `${files.length} arquivo${files.length === 1 ? '' : 's'}`;
}
let dirty = false, seenNotifs = null;
function onData(){
  syncAgents(); renderHUD(); dirty = true;
  if (panelAgent && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#pbody'))) renderPanel();
  if (H.view && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#hbody') && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) renderHub();
}
Store.on('tasks', onData);
Store.on('settings', onData);
Store.on('files', () => { onData(); syncArchive(); });
Store.on('notifs', list => {
  renderHUD();
  if (seenNotifs && !quietNotifs){ list.filter(n => !seenNotifs.has(n.id) && !n.read).sort((a, b) => a.t - b.t).forEach(n => toast('🔔 ' + n.txt)); }
  seenNotifs = new Set(list.map(n => n.id));
  if (H.view === 'notificacoes') renderHub();
});

/* ---------- Câmera ---------- */
const camPos = new THREE.Vector3(0, 6, 11), camLook = new THREE.Vector3(0, 1, 0);
let camYaw = yaw;
function updateCamera(dt, snap){
  const p = player.root.position;
  let want, look;
  if (overview){
    want = new THREE.Vector3(p.x*.35, 15.5, 12.5 + p.z*.2);
    look = new THREE.Vector3(p.x*.4, 0, p.z*.4 - .8);
  } else {
    camYaw += (((yaw - camYaw + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI) * (snap ? 1 : 1 - Math.exp(-dt*3.2));
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    want = new THREE.Vector3(p.x - fx*camDist, 2.3 + camDist*.62, p.z - fz*camDist);
    look = new THREE.Vector3(p.x + fx*1.6, 1.0, p.z + fz*1.6);
  }
  const k = snap ? 1 : 1 - Math.exp(-dt*(reduceMotion ? 9 : 4.5));
  camPos.lerp(want, k); camLook.lerp(look, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  walls.forEach(w => {
    const hide = w.test(camera.position);
    w.op = lerp(w.op, hide ? .12 : 1, snap ? 1 : 1 - Math.exp(-dt*8));
    w.mats.forEach(m => { m.opacity = w.op; m.depthWrite = w.op > .9; });
  });
  // a estante encosta na parede da frente: some junto com ela quando atrapalha a visão
  const aop = Math.max(walls[1].op, .18);
  if (Math.abs(aop - (ARCH.op || 1)) > .01 || snap){
    ARCH.op = aop; ARCH.group.traverse(o => { if (o.isMesh){ o.material.transparent = true; o.material.opacity = aop; o.material.depthWrite = aop > .9; } });
  }
}

/* ---------- Loop ---------- */
function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const clockObj = new THREE.Clock();
let screenAcc = 0;
function frame(){
  const dt = Math.min(clockObj.getDelta(), .05), t = clockObj.elapsedTime;
  const busyUI = typing() || uiOpen();
  const f = busyUI ? 0 : (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0);
  const tr = busyUI ? 0 : (keys.has('l') ? 1 : 0) - (keys.has('r') ? 1 : 0);
  turnRate = lerp(turnRate, tr * 2.6, 1 - Math.exp(-dt*12));
  yaw += turnRate * dt;
  const target = f > 0 ? 3.2 : f < 0 ? -1.7 : 0;
  speed = lerp(speed, target, 1 - Math.exp(-dt*(target ? 7 : 10)));
  if (Math.abs(speed) < .01) speed = 0;
  const p = player.root.position;
  const nx = p.x + Math.sin(yaw)*speed*dt, nz = p.z + Math.cos(yaw)*speed*dt;
  if (!blocked(nx, p.z)) p.x = nx;
  if (!blocked(p.x, nz)) p.z = nz;
  player.root.rotation.y = yaw;
  poseStanding(player, dt, speed, Math.abs(turnRate) > .3 && Math.abs(speed) < .3);
  blob.position.set(p.x, .012, p.z);

  // proximidade
  let best = null, bd = INTERACT;
  INTERACTABLES.forEach(a => { const d = distTo(a); if (d < bd){ bd = d; best = a; } });
  if (best !== nearAgent){
    nearAgent = best;
    INTERACTABLES.forEach(a => a.tag.classList.toggle('near', a === best));
    $('#prompt').hidden = !best;
    if (best) $('#promptWho').textContent = best.isArchive ? 'a Estante / Arquivo' : `${best.name} (${best.role.split(' (')[0]})`;
  }
  AGENTS.forEach(a => {
    let look = null;
    if (a === nearAgent){ const lp = a.char.root.worldToLocal(player.root.position.clone().setY(1.6)); look = clamp(Math.atan2(lp.x, lp.z), -1, 1); }
    poseSeated(a.char, dt, (a.state === 'trab' || a.state === 'rev') ? 'trab' : a.state === 'coord' ? 'coord' : 'idle', look);
  });
  screenAcc += dt;
  if (screenAcc > .2){ AGENTS.forEach(a => a.screens.forEach(s => drawScreen(s, t, a.state === 'trab' || a.state === 'rev' || a.state === 'coord'))); screenAcc = 0; }
  if (dirty){ updateBoard(); drawTV(); dirty = false; }

  plants.forEach(g => { g.rotation.z = Math.sin(t*.7 + g.userData.sway)*.012; });
  const d = new Date(), cu = clock.userData;
  cu.s.rotation.z = -d.getSeconds()/60*Math.PI*2;
  cu.m.rotation.z = -(d.getMinutes() + d.getSeconds()/60)/60*Math.PI*2;
  cu.h.rotation.z = -((d.getHours()%12) + d.getMinutes()/60)/12*Math.PI*2;

  updateCamera(dt, false);
  renderer.render(scene, camera);

  const hw = innerWidth/2, hh = innerHeight/2;
  INTERACTABLES.forEach(a => {
    const v = (a.isArchive ? a.anchor : a.char.anchor).getWorldPosition(new THREE.Vector3()).project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    a.tag.style.display = vis ? 'flex' : 'none';
    if (vis){ a.tag.style.left = (v.x*hw + hw) + 'px'; a.tag.style.top = (-v.y*hh + hh) + 'px'; }
    if (a.dot) a.dot.className = 'dot ' + STATEL[a.state || 'disp'][1];
  });
  requestAnimationFrame(frame);
}

/* ---------- Início ---------- */
AGENTS.forEach(a => { a.state = 'disp'; a.screens.forEach(s => drawScreen(s, 0, false)); });
syncArchive(); updateBoard(); drawTV();
updateCamera(0, true);
canvas.focus();
requestAnimationFrame(frame);
Store.init().then(m => { renderStoreBadge(); syncAgents(); renderHUD(); syncArchive(); dirty = true; if (!seenNotifs) seenNotifs = new Set(Store.all('notifs').map(n => n.id)); });

/* API para integrações futuras (IA, automações, Meta Ads…): as mesmas ações usadas pela interface. */
window.EscritorioVirtual = Object.freeze({createTask, startStage, completeStage, returnStage, setHold, attachFiles, listTasks: () => Store.all('tasks'), listFiles: () => Store.all('files')});
})();
