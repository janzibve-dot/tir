let scene, camera, renderer;
let currentLang = 'ru';

const translations = {
    ru: { pistol: 'Пистолет', rifle: 'Автомат', sniper: 'Снайперка', reloading: 'Перезарядка...', gameOver: 'ТЫ ПРОИГРАЛ!\nПопробуй еще раз' },
    en: { pistol: 'Pistol', rifle: 'Rifle', sniper: 'Sniper', reloading: 'Reloading...', gameOver: 'YOU LOST!\nTry again' }
};

let gameState = { isPlaying: false, isPaused: false, score: 0, level: 1, misses: 0, maxMisses: 5 };
let weapons = {
    pistol: { ammo: 10, maxAmmo: 10, damage: 1, fireRate: 500, reloadTime: 1000 },
    rifle: { ammo: 35, maxAmmo: 35, damage: 1, fireRate: 100, reloadTime: 2000 },
    sniper: { ammo: 15, maxAmmo: 15, damage: 5, fireRate: 1000, reloadTime: 3000 }
};

let currentWeapon = 'pistol';
let canShoot = true, isReloading = false;
let targets = [], particles = [], mapObjects = [];
const raycaster = new THREE.Raycaster();
let yaw = 0, pitch = 0, playerX = 0;
let isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
let moveLeftPressed = false, moveRightPressed = false;

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000033, 10, 100);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    setupLighting();
    setupEventListeners();
    setupMobileControls();
    animate();
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0x404040, 1));
    const d = new THREE.DirectionalLight(0xffffff, 0.8);
    d.position.set(10, 20, 10);
    scene.add(d);
    const n1 = new THREE.PointLight(0x00ffff, 2, 50); n1.position.set(-10, 5, -10); scene.add(n1);
    const n2 = new THREE.PointLight(0xff00ff, 2, 50); n2.position.set(10, 5, -10); scene.add(n2);
}

function createGridTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
    for(let i=0; i<512; i+=64) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(512,i); ctx.stroke(); }
    const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10,10);
    return t;
}

function createMap() {
    mapObjects.forEach(o => scene.remove(o)); mapObjects = [];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100,100), new THREE.MeshStandardMaterial({map: createGridTexture()}));
    floor.rotation.x = -Math.PI/2; scene.add(floor); mapObjects.push(floor);
}

const targetTypes = [
    { behavior: 'leftRight', size: 1 }, { behavior: 'upDown', size: 0.8 }, { behavior: 'zigzag', size: 0.6 }
];

function createTarget() {
    const type = targetTypes[Math.floor(Math.random()*targetTypes.length)];
    const target = new THREE.Mesh(
        new THREE.SphereGeometry(type.size, 16, 16),
        new THREE.MeshStandardMaterial({ color: Math.random()*0xffffff, emissive: 0xff0000, emissiveIntensity: 0.5 })
    );
    target.position.set((Math.random()-0.5)*30, Math.random()*5+2, -Math.random()*40-10);
    target.userData = { hp: 1, behavior: type.behavior, startPos: target.position.clone(), time: 0, speed: 2 + gameState.level*0.2 };
    scene.add(target); targets.push(target);
}

function hitTarget(target) {
    target.userData.hp -= weapons[currentWeapon].damage;
    if(target.userData.hp <= 0) {
        gameState.score += 10; gameState.misses = 0;
        spawnFloatingText('+10', '#00ff00');
        createHitEffect(target.position);
        scene.remove(target); targets.splice(targets.indexOf(target), 1);
        if(gameState.score >= gameState.level * 100) gameController.nextLevel();
    }
    gameController.updateHUD();
}

function spawnFloatingText(text, color) {
    const div = document.createElement('div'); div.className = 'floating-text';
    div.textContent = text; div.style.color = color;
    div.style.left = (window.innerWidth/2 + (Math.random()*60-30)) + 'px';
    div.style.top = (window.innerHeight/2) + 'px';
    document.body.appendChild(div); setTimeout(() => div.remove(), 1000);
}

const gameController = {
    startGame() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('hud').classList.add('active');
        gameState.isPlaying = true; gameState.score = 0; gameState.level = 1; gameState.misses = 0;
        createMap(); this.updateHUD(); this.spawnLoop();
    },
    spawnLoop() {
        if(!gameState.isPlaying || gameState.isPaused) return;
        if(targets.length < 6 + gameState.level) createTarget();
        setTimeout(() => this.spawnLoop(), 1500);
    },
    shoot() {
        if(!canShoot || isReloading || !gameState.isPlaying) return;
        const w = weapons[currentWeapon];
        if(w.ammo <= 0) { this.reload(); return; }
        w.ammo--; canShoot = false;
        createMuzzleFlash(); playSound(200, 0.1);
        raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const hit = raycaster.intersectObjects(targets);
        if(hit.length > 0) hitTarget(hit[0].object);
        else {
            gameState.misses++; gameState.score = Math.max(0, gameState.score - 5);
            spawnFloatingText('-5', '#ff0000');
            if(gameState.misses >= gameState.maxMisses) this.gameOver();
        }
        this.updateHUD(); setTimeout(() => canShoot = true, w.fireRate);
    },
    reload() {
        if(isReloading) return; isReloading = true;
        showNotification(translations[currentLang].reloading, weapons[currentWeapon].reloadTime);
        setTimeout(() => { weapons[currentWeapon].ammo = weapons[currentWeapon].maxAmmo; isReloading = false; this.updateHUD(); }, weapons[currentWeapon].reloadTime);
    },
    nextLevel() { gameState.level++; showNotification("УРОВЕНЬ " + gameState.level); },
    gameOver() { gameState.isPlaying = false; showNotification(translations[currentLang].gameOver, 4000); setTimeout(() => location.reload(), 4000); },
    updateHUD() {
        document.getElementById('scoreValue').textContent = gameState.score;
        document.getElementById('levelValue').textContent = gameState.level;
        document.getElementById('missValue').textContent = gameState.misses;
        document.getElementById('ammoValue').textContent = weapons[currentWeapon].ammo;
        document.getElementById('ammoMax').textContent = weapons[currentWeapon].maxAmmo;
    },
    showRecords() { alert("Рекорд: " + (localStorage.getItem('fps_score') || 0)); },
    togglePause() { 
        gameState.isPaused = !gameState.isPaused; 
        document.getElementById('pauseMenu').style.display = gameState.isPaused?'flex':'none'; 
        if (!gameState.isPaused && !isMobile) document.body.requestPointerLock();
    },
    resumeGame() { this.togglePause(); },
    backToMenu() { location.reload(); },
    updateLanguage(l) { currentLang = l; this.updateHUD(); }
};
window.gameController = gameController;

function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016;
    if(gameState.isPlaying && !gameState.isPaused) {
        targets.forEach(t => {
            const d = t.userData; d.time += delta;
            if(d.behavior === 'leftRight') t.position.x = d.startPos.x + Math.sin(d.time * d.speed) * 5;
            if(d.behavior === 'upDown') t.position.y = d.startPos.y + Math.sin(d.time * d.speed) * 2;
            if(d.behavior === 'zigzag') { t.position.x = d.startPos.x + Math.sin(d.time * d.speed) * 4; t.position.y = d.startPos.y + Math.cos(d.time * d.speed) * 2; }
        });
        if(isMobile) {
            if(moveLeftPressed) { playerX -= 0.1; camera.position.x = playerX; }
            if(moveRightPressed) { playerX += 0.1; camera.position.x = playerX; }
        }
    }
    renderer.render(scene, camera);
}

function setupEventListeners() {
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    
    document.addEventListener('mousemove', (e) => { 
        if(!gameState.isPlaying || !document.pointerLockElement || isMobile) return; 
        yaw -= e.movementX*0.002; 
        pitch -= e.movementY*0.002; 
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch)); 
        camera.rotation.order = 'YXZ'; 
        camera.rotation.y = yaw; 
        camera.rotation.x = pitch; 
    });

    document.addEventListener('mousedown', () => { 
        if(gameState.isPlaying && !isMobile && !document.pointerLockElement && !gameState.isPaused) {
            document.body.requestPointerLock();
        } else if (gameState.isPlaying && !isMobile && document.pointerLockElement) {
            gameController.shoot();
        }
    });

    document.addEventListener('keydown', (e) => { 
        if(!gameState.isPlaying) return;
        if(e.key.toLowerCase() === 'a') { playerX -= 0.5; camera.position.x = playerX; }
        if(e.key.toLowerCase() === 'd') { playerX += 0.5; camera.position.x = playerX; }
        if(e.key.toLowerCase() === 'r') gameController.reload(); 
        if(e.key === 'Escape') gameController.togglePause(); 
    });
}

function setupMobileControls() {
    if(!isMobile) return;
    const bind = (id, s, e) => { const el = document.getElementById(id); el.addEventListener('touchstart', (ev) => { ev.preventDefault(); s(); }); el.addEventListener('touchend', (ev) => { ev.preventDefault(); e(); }); };
    bind('moveLeft', () => moveLeftPressed = true, () => moveLeftPressed = false);
    bind('moveRight', () => moveRightPressed = true, () => moveRightPressed = false);
    document.getElementById('shootButton').addEventListener('touchstart', (e) => { e.preventDefault(); gameController.shoot(); });
    document.getElementById('reloadButton').addEventListener('touchstart', (e) => { e.preventDefault(); gameController.reload(); });
}

function createMuzzleFlash() { const f = new THREE.PointLight(0xffff00, 5, 3); f.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.5)); scene.add(f); setTimeout(() => scene.remove(f), 50); }
function createHitEffect(pos) { for(let i=0; i<5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff6600})); p.position.copy(pos); scene.add(p); setTimeout(() => scene.remove(p), 500); } }
function playSound(f, d) { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; g.gain.setValueAtTime(0.1, c.currentTime); o.start(); o.stop(c.currentTime + d); } catch(e) {} }
function showNotification(t, dur = 2000) { const n = document.getElementById('notification'); n.innerHTML = t.replace('\n', '<br>'); n.style.display = 'block'; setTimeout(() => n.style.display = 'none', dur); }

window.addEventListener('load', init);
