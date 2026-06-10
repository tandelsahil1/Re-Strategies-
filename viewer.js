import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from "web-ifc-three/IFCLoader.js";

// DOM
const topTitle  = document.getElementById('topTitle');
const uploadZone= document.getElementById('uploadZone');
const filePill  = document.getElementById('filePill');
const fName     = document.getElementById('fName');
const fSize     = document.getElementById('fSize');
const sbScroll  = document.getElementById('sbScroll');
const emptyEl   = document.getElementById('emptyEl');
const loadEl    = document.getElementById('loadEl');
const loadSub   = document.getElementById('loadSub');
const importBtn = document.getElementById('importBtn');
const sDot      = document.getElementById('sDot');
const sTxt      = document.getElementById('sTxt');
const toast     = document.getElementById('toast');
const canvas    = document.getElementById('three-canvas');

// State
let scene, camera, renderer, controls, ifcLoader;
let ifcModel = null;
let modelID = null;
let ifcData = { floors:[], spaces:[], walls:[], slabs:[] };
let selectedRooms = new Set();
let isWireframe = false;
let isXray = false;

// Helpers
const setStatus = (dot, txt) => {
  sDot.className = 'dot' + (dot ? ` ${dot}` : '');
  sTxt.textContent = txt;
};
const showLoad = (show, msg='') => {
  loadEl.classList.toggle('hide', !show);
  if (msg) loadSub.textContent = msg;
};
const fmt = b => b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';
const showToast = msg => {
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display='none', 3000);
};
const row = (k, v) => `<div class="prop-row"><span class="pk">${k}</span><span class="pv">${v}</span></div>`;

// Init Three.js
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);

  const rect = canvas.parentElement.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(60, rect.width/rect.height, 0.01, 5000);
  camera.position.set(15, 15, 15);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(rect.width, rect.height, false);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(10, 20, 10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xeaf0ff, 0x2a364a, 0.4));
  scene.add(new THREE.GridHelper(50, 50, 0x224466, 0x112233));

  ifcLoader = new IFCLoader();
  ifcLoader.ifcManager.setWasmPath("/");

  window.addEventListener('resize', onResize);
  onResize();
  animate();
  setStatus('g', 'Viewer ready — Open an IFC file');
}

function onResize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

async function loadIFC(file) {
  if (!scene) initScene();
  if (ifcModel) {
    scene.remove(ifcModel);
    ifcModel = null;
  }

  showLoad(true, 'Parsing IFC...');
  emptyEl.classList.add('hide');
  setStatus('y', `Loading ${file.name}...`);

  try {
    const url = URL.createObjectURL(file);
    ifcModel = await ifcLoader.loadAsync(url);
    URL.revokeObjectURL(url);
    modelID = ifcModel.modelID;
    scene.add(ifcModel);
    fitCamera(ifcModel);
    fName.textContent = file.name;
    fSize.textContent = fmt(file.size);
    filePill.classList.add('show');
    uploadZone.style.display = 'none';
    topTitle.textContent = file.name;
    await extractData();
    renderSidebar();
    importBtn.classList.add('show');
    showLoad(false);
    setStatus('g', `✅ ${file.name} — ${ifcData.spaces.length} rooms`);
  } catch(err) {
    showLoad(false);
    setStatus('r', `❌ ${err.message}`);
    console.error(err);
  }
}

function fitCamera(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const m = Math.max(s.x, s.y, s.z);
  const d = (m/2)/Math.tan((camera.fov*Math.PI/180)/2)*1.8;
  camera.position.set(c.x+d*0.7, c.y+d*0.5, c.z+d*0.7);
  controls.target.copy(c);
  controls.update();
}

async function extractData() {
  ifcData = { floors:[], spaces:[], walls:[], slabs:[] };
  const mgr = ifcLoader.ifcManager;
  const types = { FLOOR:3124254112, SPACE:3856911033, WALL:2391406946, WSC:477021311, SLAB:1529196076 };
  
  try { 
    const ids = await mgr.getAllItemsOfType(modelID, types.FLOOR, false);
    for (const id of ids) {
      const p = await mgr.getItemProperties(modelID, id);
      ifcData.floors.push({ id, name: p.Name?.value || `Floor ${id}` });
    }
  } catch(e) {}
  
  try {
    const ids = await mgr.getAllItemsOfType(modelID, types.SPACE, false);
    for (const id of ids) {
      const p = await mgr.getItemProperties(modelID, id);
      ifcData.spaces.push({ id, name: p.Name?.value || p.LongName?.value || `Space ${id}` });
    }
  } catch(e) {}
  
  try {
    const w1 = await mgr.getAllItemsOfType(modelID, types.WALL, false);
    const w2 = await mgr.getAllItemsOfType(modelID, types.WSC, false);
    for (const id of [...w1, ...w2]) {
      const p = await mgr.getItemProperties(modelID, id);
      ifcData.walls.push({ id, name: p.Name?.value || `Wall ${id}` });
    }
  } catch(e) {}
  
  try {
    const ids = await mgr.getAllItemsOfType(modelID, types.SLAB, false);
    for (const id of ids) {
      const p = await mgr.getItemProperties(modelID, id);
      ifcData.slabs.push({ id, name: p.Name?.value || `Slab ${id}` });
    }
  } catch(e) {}
  
  console.log('Extracted:', ifcData);
}

function renderSidebar() {
  const { floors, spaces, walls, slabs } = ifcData;
  let html = `<div class="sec-head">🏢 Model Summary</div>`;
  html += row('Floors', floors.length);
  html += row('Spaces', spaces.length);
  html += row('Walls', walls.length);
  html += row('Slabs', slabs.length);
  
  if (spaces.length > 0) {
    html += `<div class="sec-head" style="margin-top:14px;">🏬 Rooms</div>`;
    html += `<div style="font-size:0.7rem;color:#aab3c6;margin-bottom:8px;">Select rooms to import</div>`;
    const floorName = floors[0]?.name || 'Ground Floor';
    html += `<div class="floor-label">📐 ${floorName}</div>`;
    for (const sp of spaces) {
      const sel = selectedRooms.has(sp.id);
      html += `<div class="room-item ${sel?'sel':''}" onclick="window.toggleRoom(${sp.id})"><span>${sel?'✅':'⬜'}</span><div><div class="room-name">${sp.name}</div><div class="room-meta">IfcSpace #${sp.id}</div></div></div>`;
    }
  }
  
  sbScroll.innerHTML = html;
  updateImportBtn();
}

window.toggleRoom = id => {
  selectedRooms.has(id) ? selectedRooms.delete(id) : selectedRooms.add(id);
  renderSidebar();
};

function updateImportBtn() {
  const n = selectedRooms.size;
  importBtn.textContent = n > 0 ? `🚀 Import ${n} Room${n>1?'s':''} to LCA Tool` : `🚀 Import All Rooms to LCA Tool`;
}

importBtn.addEventListener('click', () => {
  const spaces = selectedRooms.size > 0 ? ifcData.spaces.filter(s => selectedRooms.has(s.id)) : ifcData.spaces;
  if (spaces.length === 0) { showToast('⚠️ No rooms'); return; }
  const floors = ifcData.floors.length > 0 ? ifcData.floors : [{ id:'f0', name:'Ground Floor' }];
  const payload = {
    type: 'IFC_IMPORT',
    building: {
      name: topTitle.textContent.replace(/\.ifc$/i,'') || 'IFC Building',
      location: '',
      projectType: 'office',
      floors: floors.map((floor, fi) => ({
        id: `floor-ifc-${fi}`,
        name: floor.name,
        rooms: spaces.map((sp, ri) => ({
          id: `room-ifc-${fi}-${ri}`,
          name: sp.name,
          dims: { length: 5, width: 5, height: 2.7 },
          fromIFC: true,
          ifcId: sp.id
        }))
      }))
    }
  };
  localStorage.setItem('lindner-ifc-import', JSON.stringify(payload));
  showToast(`✅ Importing ${spaces.length} rooms...`);
  setTimeout(() => { window.location.href = './index.html?from=ifc'; }, 1200);
});

document.getElementById('btnFit').onclick = () => { if (ifcModel) fitCamera(ifcModel); };

document.getElementById('btnWire').onclick = function() {
  if (!ifcModel) return;
  isWireframe = !isWireframe;
  ifcModel.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => m.wireframe = isWireframe);
  });
  this.classList.toggle('active', isWireframe);
};

document.getElementById('btnXray').onclick = function() {
  if (!ifcModel) return;
  isXray = !isXray;
  ifcModel.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      m.transparent = isXray;
      m.opacity = isXray ? 0.25 : 1;
      m.depthWrite = !isXray;
    });
  });
  this.classList.toggle('active', isXray);
};

document.getElementById('ifcIn').onchange = e => {
  if (e.target.files[0]) loadIFC(e.target.files[0]);
};
uploadZone.onclick = () => document.getElementById('ifcIn').click();
uploadZone.ondragover = e => { e.preventDefault(); uploadZone.classList.add('drag'); };
uploadZone.ondragleave = () => uploadZone.classList.remove('drag');
uploadZone.ondrop = e => {
  e.preventDefault();
  uploadZone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f?.name.toLowerCase().endsWith('.ifc')) loadIFC(f);
};

initScene();
