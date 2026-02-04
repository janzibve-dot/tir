let scene, camera, renderer;
let currentLang = 'ru';

const translations = {
    ru: {
        pistol: 'Пистолет',
        rifle: 'Автомат',
        sniper: 'Снайперская винтовка',
        reloading: 'Перезарядка...',
        level: 'Уровень',
        gameOver: 'ТЫ ПРОИГРАЛ!\nПопробуй еще раз',
        noSave: 'Нет сохранений'
    },
    en: {
        pistol: 'Pistol',
        rifle: 'Rifle',
        sniper: 'Sniper Rifle',
        reloading: 'Reloading...',
        level: 'Level',
        gameOver: 'YOU LOST!\nTry again',
        noSave: 'No save'
    }
};

let gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    level: 1,
    misses: 0,
    maxMisses: 5
};

let weapons = {
    pistol: { name: 'pistol', ammo: 10, maxAmmo: 10, damage: 1, fireRate: 500, reloadTime: 1000 },
    rifle: { name: 'rifle', ammo: 35, maxAmmo: 35, damage: 1, fireRate: 100, reloadTime: 2000 },
    sniper: { name: 'sniper', ammo: 15, maxAmmo: 15, damage: 5, fireRate: 1000, reloadTime: 3000 }
};

let currentWeapon = 'pistol';
let canShoot = true;
let isReloading = false;
let targets = [];
let particles = [];
let interactiveObjects = [];
const raycaster = new THREE.Raycaster();
let yaw = 0, pitch = 0, playerX = 0;

let isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
let moveLeftPressed = false, moveRightPressed = false;

const sounds = {
    shoot: () => playSound(200, 0.1),
    hit: () => playSound(400, 0.1),
    miss: () => playSound(100, 0.2),
    reload: () => playSound(300, 0.2)
};

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000033, 10, 150);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onMouseClick);
    document.addEventListener('keydown', onKeyDown);
}

function setupMobileControls() {
    if (!isMobile) return;
    const bind = (id, start, end) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
        el.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
    };
    bind('moveLeft', () => moveLeftPressed = true, () => moveLeftPressed = false);
    bind('moveRight', () => moveRightPressed = true, () => moveRightPressed = false);
    document.getElementById('shootButton').addEventListener('touchstart', (e) => { e.preventDefault(); gameController.shoot(); });
    document.getElementById('reloadButton').addEventListener('touchstart', (e) => { e.preventDefault(); gameController.reload(); });
}

function createTarget() {
    const geometry = new THREE.SphereGeometry(Math.random() * 0.5 + 0.3, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const target = new THREE.Mesh(geometry, material);
    
    // Появление и вдалеке (до 60 метров)
    target.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 8 + 1,
        -Math.random() * 50 - 5 
    );
    
    target.userData = { hp: 1, points: 10, createdAt: Date.now() };
    scene.add(target);
    targets.push(target);
}

function hitTarget(target) {
    const data = target.userData;
    data.hp -= weapons[currentWeapon].damage;
    
    if (data.hp <= 0) {
        spawnFloatingText('+10', '#00ff00');
        gameState.score += 10;
        gameState.misses = 0; // Сброс промахов при попадании
        sounds.hit();
        createHitEffect(target.position);
        scene.remove(target);
        targets.splice(targets.indexOf(target), 1);
        if (gameState.score >= gameState.level * 100) gameController.nextLevel();
    }
    gameController.updateHUD();
}

function spawnFloatingText(text, color) {
    const div = document.createElement('div');
    div.className = 'floating-text';
    div.textContent = text;
    div.style.color = color;
    div.style.left = (window.innerWidth / 2 + (Math.random() * 100 - 50)) + 'px';
    div.style.top = (window.innerHeight / 2) + 'px';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

const gameController = {
    startGame() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('hud').classList.add('active');
        gameState.isPlaying = true;
        gameState.score = 0;
        gameState.level = 1;
        gameState.misses = 0;
        this.updateHUD();
        this.spawnLoop();
        if (!isMobile) document.body.requestPointerLock();
    },
    spawnLoop() {
        if (!gameState.isPlaying || gameState.isPaused) return;
        if (targets.length < 8) createTarget();
        setTimeout(() => this.spawnLoop(), 1000);
    },
    shoot() {
        if (!canShoot || isReloading || !gameState.isPlaying) return;
        const w = weapons[currentWeapon];
        if (w.ammo <= 0) { this.reload(); return; }
        
        w.ammo--;
        canShoot = false;
        sounds.shoot();
        createMuzzleFlash();
        
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hit = raycaster.intersectObjects(targets);
        
        if (hit.length > 0) {
            hitTarget(hit[0].object);
        } else {
            // Промах
            gameState.misses++;
            gameState.score = Math.max(0, gameState.score - 5);
            spawnFloatingText('-5', '#ff0000');
            sounds.miss();
            if (gameState.misses >= gameState.maxMisses) {
                this.gameOver();
            }
        }
        this.updateHUD();
        setTimeout(() => canShoot = true, w.fireRate);
    },
    reload() {
        if (isReloading) return;
        isReloading = true;
        sounds.reload();
        showNotification(translations[currentLang].reloading, weapons[currentWeapon].reloadTime);
        setTimeout(() => {
            weapons[currentWeapon].ammo = weapons[currentWeapon].maxAmmo;
            isReloading = false;
            this.updateHUD();
        }, weapons[currentWeapon].reloadTime);
    },
    nextLevel() {
        gameState.level++;
        gameState.misses = 0;
        showNotification(translations[currentLang].level + " " + gameState.level);
        this.updateHUD();
    },
    gameOver() {
        gameState.isPlaying = false;
        showNotification(translations[currentLang].gameOver, 4000);
        setTimeout(() => this.backToMenu(), 4000);
    },
    updateHUD() {
        document.getElementById('scoreValue').textContent = gameState.score;
        document.getElementById('levelValue').textContent = gameState.level;
        document.getElementById('missValue').textContent = gameState.misses;
        const w = weapons[currentWeapon];
        document.getElementById('ammoValue').textContent = w.ammo;
        document.getElementById('ammoMax').textContent = w.maxAmmo;
        document.getElementById('weaponName').textContent = translations[currentLang][currentWeapon];
    },
    showRecords() { alert("Рекорд: " + (localStorage.getItem('fps_score') || 0)); },
    togglePause() { 
        gameState.isPaused = !gameState.isPaused;
        document.getElementById('pauseMenu').style.display = gameState.isPaused ? 'flex' : 'none';
    },
    resumeGame() { this.togglePause(); },
    backToMenu() { location.reload(); },
    updateLanguage(l) { currentLang = l; this.updateHUD(); }
};

window.gameController = gameController;

function createMuzzleFlash() {
    const f = new THREE.PointLight(0xffff00, 5, 3);
    f.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.5));
    scene.add(f);
    setTimeout(() => scene.remove(f), 50);
}

function createHitEffect(pos) {
    for(let i=0; i<5; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff6600}));
        p.position.copy(pos);
        p.userData = { velocity: new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2), life: 0.5 };
        scene.add(p);
        particles.push(p);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016;
    if (gameState.isPlaying && !gameState.isPaused) {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].userData.life -= delta;
            if (particles[i].userData.life <= 0) { scene.remove(particles[i]); particles.splice(i, 1); }
            else particles[i].position.add(particles[i].userData.velocity.clone().multiplyScalar(delta));
        }
        if (isMobile) {
            if (moveLeftPressed) { playerX -= 0.1; camera.position.x = playerX; }
            if (moveRightPressed) { playerX += 0.1; camera.position.x = playerX; }
        }
    }
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
    if (!gameState.isPlaying || !document.pointerLockElement || isMobile) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

function onMouseClick() { if (gameState.isPlaying && !isMobile && document.pointerLockElement) gameController.shoot(); }

function onKeyDown(e) {
    if (!gameState.isPlaying) return;
    if (e.key === 'a') { playerX -= 0.5; camera.position.x = playerX; }
    if (e.key === 'd') { playerX += 0.5; camera.position.x = playerX; }
    if (e.key === 'r') gameController.reload();
    if (e.key === 'Escape') gameController.togglePause();
}

function playSound(f, d) {
    try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = f;
        g.gain.setValueAtTime(0.1, c.currentTime);
        o.start(); o.stop(c.currentTime + d);
    } catch(e) {}
}

function showNotification(t, dur = 2000) {
    const n = document.getElementById('notification');
    n.innerHTML = t.replace('\n', '<br>');
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', dur);
}

window.addEventListener('load', init);
