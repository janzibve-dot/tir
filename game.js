let scene, camera, renderer;
let currentLang = 'ru';

const translations = {
    ru: {
        pistol: 'Пистолет',
        rifle: 'Автомат',
        sniper: 'Снайперская винтовка',
        reloading: 'Перезарядка...',
        level: 'Уровень',
        noSave: 'Нет сохранённой игры!',
        bestScore: 'Лучший результат',
        points: 'очков',
        hit: 'Попадание!',
        miss: 'Промах!',
        levelComplete: 'Уровень пройден!',
        gameOver: 'Игра окончена!',
        maps: {
            0: 'Тир будущего',
            1: 'Кибер-арена',
            2: 'Город',
            3: 'Завод',
            4: 'Военная база',
            5: 'Футуристический полигон'
        }
    },
    en: {
        pistol: 'Pistol',
        rifle: 'Rifle',
        sniper: 'Sniper Rifle',
        reloading: 'Reloading...',
        level: 'Level',
        noSave: 'No saved game!',
        bestScore: 'Best Score',
        points: 'points',
        hit: 'Hit!',
        miss: 'Miss!',
        levelComplete: 'Level Complete!',
        gameOver: 'Game Over!',
        maps: {
            0: 'Future Range',
            1: 'Cyber Arena',
            2: 'City',
            3: 'Factory',
            4: 'Military Base',
            5: 'Futuristic Polygon'
        }
    }
};

let gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    level: 1,
    currentMap: 0,
    consecutiveHits: 0,
    bestScore: 0
};

let weapons = {
    pistol: { name: 'pistol', ammo: 10, maxAmmo: 10, damage: 1, fireRate: 500, reloadTime: 1000 },
    rifle: { name: 'rifle', ammo: 35, maxAmmo: 35, damage: 1, fireRate: 100, reloadTime: 2000 },
    sniper: { name: 'sniper', ammo: 15, maxAmmo: 15, damage: 2, fireRate: 1000, reloadTime: 3000 }
};

let currentWeapon = 'pistol';
let canShoot = true;
let isReloading = false;

let targets = [];
let particles = [];
let mapObjects = [];
let interactiveObjects = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let yaw = 0;
let pitch = 0;
let playerX = 0;

let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let touchStartX = 0;
let touchStartY = 0;
let moveLeftPressed = false;
let moveRightPressed = false;

const sounds = {
    shoot: () => playSound(200, 0.1),
    hit: () => playSound(400, 0.1),
    miss: () => playSound(100, 0.05),
    reload: () => playSound(300, 0.2)
};

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000033, 10, 100);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('gameCanvas'),
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    setupLighting();
    setupEventListeners();
    setupMobileControls();
    loadProgress();
    animate();
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const neonLight1 = new THREE.PointLight(0x00ffff, 2, 50);
    neonLight1.position.set(-10, 5, -10);
    scene.add(neonLight1);

    const neonLight2 = new THREE.PointLight(0xff00ff, 2, 50);
    neonLight2.position.set(10, 5, -10);
    scene.add(neonLight2);

    const dynamicLight = new THREE.PointLight(0x00ff00, 1, 30);
    dynamicLight.position.set(0, 3, -15);
    scene.add(dynamicLight);
    
    setInterval(() => {
        if (gameState.isPlaying && !gameState.isPaused) {
            dynamicLight.intensity = 1 + Math.sin(Date.now() * 0.003) * 0.5;
            dynamicLight.color.setHSL(Math.sin(Date.now() * 0.001) * 0.5 + 0.5, 1, 0.5);
        }
    }, 50);
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onMouseClick);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', onKeyDown);
    
    if (isMobile) {
        document.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
    }
}

function setupMobileControls() {
    if (!isMobile) return;

    document.getElementById('moveLeft').addEventListener('touchstart', (e) => {
        e.preventDefault();
        moveLeftPressed = true;
    });
    
    document.getElementById('moveLeft').addEventListener('touchend', (e) => {
        e.preventDefault();
        moveLeftPressed = false;
    });

    document.getElementById('moveRight').addEventListener('touchstart', (e) => {
        e.preventDefault();
        moveRightPressed = true;
    });
    
    document.getElementById('moveRight').addEventListener('touchend', (e) => {
        e.preventDefault();
        moveRightPressed = false;
    });

    document.getElementById('shootButton').addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameController.shoot();
    });

    document.getElementById('reloadButton').addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameController.reload();
    });

    document.querySelectorAll('.weapon-btn').forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const weaponType = btn.getAttribute('data-weapon');
            gameController.changeWeapon(weaponType);
            document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function onTouchStart(e) {
    if (!gameState.isPlaying || e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function onTouchMove(e) {
    if (!gameState.isPlaying || e.touches.length === 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    yaw -= deltaX * 0.005;
    pitch -= deltaY * 0.005;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

const maps = [
    { name: 'Тир будущего', nameEn: 'Future Range', color: 0x001a33, fogColor: 0x000033 },
    { name: 'Кибер-арена', nameEn: 'Cyber Arena', color: 0x1a0033, fogColor: 0x330066 },
    { name: 'Город', nameEn: 'City', color: 0x1a1a00, fogColor: 0x333300 },
    { name: 'Завод', nameEn: 'Factory', color: 0x0d0d0d, fogColor: 0x1a1a1a },
    { name: 'Военная база', nameEn: 'Military Base', color: 0x001a00, fogColor: 0x003300 },
    { name: 'Футуристический полигон', nameEn: 'Futuristic Polygon', color: 0x00331a, fogColor: 0x006633 }
];

function createMap(mapIndex) {
    mapObjects.forEach(obj => scene.remove(obj));
    mapObjects = [];
    interactiveObjects.forEach(obj => scene.remove(obj));
    interactiveObjects = [];

    const mapData = maps[mapIndex % maps.length];
    scene.background = new THREE.Color(mapData.color);
    scene.fog.color = new THREE.Color(mapData.fogColor);

    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorTexture = createGridTexture();
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        map: floorTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    mapObjects.push(floor);

    for (let i = 0; i < 20; i++) {
        const boxGeometry = new THREE.BoxGeometry(Math.random() * 3 + 1, Math.random() * 5 + 2, Math.random() * 3 + 1);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            emissive: Math.random() * 0x333333,
            roughness: 0.5,
            metalness: 0.5
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set((Math.random() - 0.5) * 80, boxGeometry.parameters.height / 2, (Math.random() - 0.5) * 80);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
        mapObjects.push(box);
        interactiveObjects.push(box);
    }

    const mapName = currentLang === 'ru' ? mapData.name : mapData.nameEn;
    showNotification(`${translations[currentLang].level}: ${mapName}`, 2000);
}

function updateInteractiveObjects(delta) {
    interactiveObjects.forEach(obj => {
        if (obj.userData.rotationSpeed) {
            obj.rotation.y += obj.userData.rotationSpeed;
        }
        if (obj.userData.floatOffset !== undefined) {
            obj.position.y += Math.sin(Date.now() * 0.001 * obj.userData.floatSpeed + obj.userData.floatOffset) * 0.01;
        }
    });
}

function createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    return texture;
}

const targetTypes = [
    { name: 'round', hp: 1, points: 10, size: 1, speed: 2, behavior: 'leftRight' },
    { name: 'square', hp: 1, points: 10, size: 1, speed: 2, behavior: 'upDown' },
    { name: 'boss', hp: 5, points: 100, size: 3, speed: 1, behavior: 'boss' }
];

function createTarget() {
    const level = gameState.level;
    const typeData = targetTypes[Math.floor(Math.random() * targetTypes.length)];
    const geometry = new THREE.SphereGeometry(typeData.size * 0.5, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const target = new THREE.Mesh(geometry, material);
    target.position.set((Math.random() - 0.5) * 30, Math.random() * 5 + 2, -Math.random() * 20 - 10);
    target.userData = {
        hp: typeData.hp,
        points: typeData.points,
        speed: typeData.speed * (1 + level * 0.1),
        behavior: typeData.behavior,
        lifeTime: 3000,
        createdAt: Date.now(),
        startPos: target.position.clone(),
        time: 0
    };
    scene.add(target);
    targets.push(target);
}

function updateTargets(delta) {
    const currentTime = Date.now();
    for (let i = targets.length - 1; i >= 0; i--) {
        const target = targets[i];
        const data = target.userData;
        if (currentTime - data.createdAt > data.lifeTime) {
            scene.remove(target);
            targets.splice(i, 1);
            continue;
        }
        data.time += delta;
        if (data.behavior === 'leftRight') {
            target.position.x = data.startPos.x + Math.sin(data.time * data.speed) * 5;
        } else if (data.behavior === 'upDown') {
            target.position.y = data.startPos.y + Math.sin(data.time * data.speed) * 2;
        }
    }
}

function hitTarget(target) {
    const data = target.userData;
    data.hp -= weapons[currentWeapon].damage;
    createHitEffect(target.position);
    if (data.hp <= 0) {
        gameState.score += data.points;
        gameState.consecutiveHits++;
        sounds.hit();
        scene.remove(target);
        targets.splice(targets.indexOf(target), 1);
        if (gameState.score >= gameState.level * 100) gameController.nextLevel();
    }
    gameController.updateHUD();
}

const gameController = {
    startGame() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('hud').classList.add('active');
        gameState.isPlaying = true;
        gameState.score = 0;
        gameState.level = 1;
        this.updateHUD();
        createMap(0);
        this.spawnTargets();
        if (!isMobile) document.body.requestPointerLock();
    },
    continueGame() {
        const savedLevel = parseInt(localStorage.getItem('fps_level') || 0);
        if (savedLevel >= 1) {
            this.startGame();
            gameState.level = savedLevel;
            gameState.score = parseInt(localStorage.getItem('fps_score') || 0);
            this.updateHUD();
        } else {
            showNotification(translations[currentLang].noSave);
        }
    },
    spawnTargets() {
        if (!gameState.isPlaying || gameState.isPaused) return;
        if (targets.length < 5) createTarget();
        setTimeout(() => this.spawnTargets(), 1000);
    },
    shoot() {
        if (!canShoot || isReloading || !gameState.isPlaying) return;
        const weapon = weapons[currentWeapon];
        if (weapon.ammo <= 0) { this.reload(); return; }
        weapon.ammo--;
        this.updateHUD();
        canShoot = false;
        sounds.shoot();
        createMuzzleFlash();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(targets);
        if (intersects.length > 0) {
            hitTarget(intersects[0].object);
        } else {
            gameState.consecutiveHits = 0;
            sounds.miss();
        }
        setTimeout(() => canShoot = true, weapon.fireRate);
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
    changeWeapon(key) {
        if (isReloading) return;
        currentWeapon = key;
        this.updateHUD();
    },
    nextLevel() {
        gameState.level++;
        createMap(gameState.level);
        this.saveProgress();
    },
    updateHUD() {
        document.getElementById('scoreValue').textContent = gameState.score;
        document.getElementById('levelValue').textContent = gameState.level;
        const weapon = weapons[currentWeapon];
        document.getElementById('ammoValue').textContent = weapon.ammo;
        document.getElementById('ammoMax').textContent = weapon.maxAmmo;
        document.getElementById('weaponName').textContent = translations[currentLang][weapon.name];
    },
    showRecords() {
        alert(localStorage.getItem('fps_bestScore') || 0);
    },
    togglePause() {
        gameState.isPaused = !gameState.isPaused;
        document.getElementById('pauseMenu').style.display = gameState.isPaused ? 'flex' : 'none';
    },
    resumeGame() { this.togglePause(); },
    backToMenu() { location.reload(); },
    saveProgress() {
        localStorage.setItem('fps_level', gameState.level);
        localStorage.setItem('fps_score', gameState.score);
        if (gameState.score > (localStorage.getItem('fps_bestScore') || 0)) {
            localStorage.setItem('fps_bestScore', gameState.score);
        }
    },
    updateLanguage(lang) {
        currentLang = lang;
        this.updateHUD();
    }
};
window.gameController = gameController;

function createMuzzleFlash() {
    const flash = new THREE.PointLight(0xffff00, 5, 3);
    flash.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.5));
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 50);
}

function createHitEffect(pos) {
    const geom = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const p = new THREE.Mesh(geom, mat);
    p.position.copy(pos);
    p.userData = { velocity: new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2), life: 0.5 };
    scene.add(p);
    particles.push(p);
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= delta;
        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        } else {
            p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
        }
    }
}

function showNotification(text, duration = 2000) {
    const n = document.getElementById('notification');
    n.textContent = text;
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', duration);
}

function loadProgress() {
    gameState.bestScore = parseInt(localStorage.getItem('fps_bestScore') || 0);
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

function onMouseClick() {
    if (gameState.isPlaying && !isMobile && document.pointerLockElement) gameController.shoot();
}

function onKeyDown(e) {
    if (!gameState.isPlaying) return;
    if (e.key === 'a') { playerX -= 0.5; camera.position.x = playerX; }
    if (e.key === 'd') { playerX += 0.5; camera.position.x = playerX; }
    if (e.key === 'r') gameController.reload();
    if (e.key === 'Escape') gameController.togglePause();
}

function playSound(freq, dur) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + dur);
    } catch (e) {}
}

function animate() {
    requestAnimationFrame(animate);
    if (gameState.isPlaying && !gameState.isPaused) {
        updateTargets(0.016);
        updateParticles(0.016);
        if (isMobile) {
            if (moveLeftPressed) { playerX -= 0.05; camera.position.x = playerX; }
            if (moveRightPressed) { playerX += 0.05; camera.position.x = playerX; }
        }
    }
    renderer.render(scene, camera);
}

window.addEventListener('load', init);
