
        // Mobile detection and optimization
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // IndexedDB setup for local storage
        const DBHelper = {
            dbName: 'HalteroAI',
            dbVersion: 1,
            db: null,
            
            init: async function() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(this.dbName, this.dbVersion);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => { this.db = request.result; resolve(this.db); };
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('lifts')) {
                            db.createObjectStore('lifts', { keyPath: 'id', autoIncrement: true });
                        }
                    };
                });
            },
            
            saveLift: async function(data) {
                if (!this.db) await this.init();
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction(['lifts'], 'readwrite');
                    const store = tx.objectStore('lifts');
                    const countReq = store.count();
                    countReq.onsuccess = () => {
                        if (countReq.result >= 50) {
                            const curReq = store.openCursor();
                            curReq.onsuccess = (e) => {
                                const cursor = e.target.result;
                                if (cursor) { store.delete(cursor.primaryKey); }
                            };
                        }
                        store.add(data);
                    };
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            }
        };
        
        const app = {
            mode: null,
            isCameraActive: false, isRecording: false,
            isProcessing: false,
            isProcessingFrame: false,
            isAppVisible: true,
            targetFps: 30,
            lastFrameTime: 0,
            currentObjectUrl: null,
            compareObjectUrls: { top: null, bot: null },
            stream: null,
            pose: null, hands: null, barPath: [], 
            frameData: [], minHipHeight: 0, 
            currentMap: null,
            
            zoomLevels: { top: 1, bot: 1 }, flipStates: { top: 1, bot: 1 }, panOffsets: { top: {x:0, y:0}, bot: {x:0, y:0} },
            dragState: { active: false, startX: 0, startY: 0, initialX: 0, initialY: 0, target: null },
            layoutMode: 'col',
            settings: { gestureRecord: false, soundConfirm: true, flashConfirm: false },
            gestureState: { holdFrames: 0, lastToggleTime: 0, countdown: { active: false, target: 0, startTime: 0, lastTick: -1 } },
            audioCtx: null,
            cameraFacing: 'environment',
            exerciseGuides: {
                DEFAULT: {
                    title: 'Guia general',
                    items: [
                        'Perfil completo (90 grados) y cuerpo entero visible.',
                        'Camara a la altura de la cadera, a 1-2 metros.',
                        'Fondo limpio, buena luz frontal, movil estable.'
                    ]
                },
                BACK_SQUAT: {
                    title: 'Back Squat (Trasera)',
                    items: [
                        'Perfil completo y cuerpo entero en cuadro.',
                        'Camara a la altura de la cadera.',
                        'Busca profundidad: cadera por debajo de rodilla.'
                    ]
                },
                FRONT_SQUAT: {
                    title: 'Front Squat (Frontal)',
                    items: [
                        'Perfil completo y cuerpo entero en cuadro.',
                        'Torso lo mas vertical posible durante la bajada.',
                        'Profundidad completa sin perder postura.'
                    ]
                },
                OH_SQUAT: {
                    title: 'Overhead Squat',
                    items: [
                        'Perfil completo y brazos visibles en todo momento.',
                        'Codos bloqueados arriba (brazos extendidos).',
                        'Profundidad completa con estabilidad.'
                    ]
                },
                SQUAT_CLEAN: {
                    title: 'Squat Clean (Completo)',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Recibe profundo: cadera baja en la recepcion.',
                        'Torso firme, sin colapsar pecho.'
                    ]
                },
                POWER_CLEAN: {
                    title: 'Power Clean',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Recepcion alta (no bajes demasiado).',
                        'Torso firme y estable.'
                    ]
                },
                MUSCLE_CLEAN: {
                    title: 'Muscle Clean',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Sin flexion de piernas en la recepcion.',
                        'Codos altos y control de espalda.'
                    ]
                },
                HANG_SQUAT_CLEAN: {
                    title: 'Hang Squat Clean',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Inicio desde hang, recibe profundo.',
                        'Torso firme durante el tiron.'
                    ]
                },
                HANG_POWER_CLEAN: {
                    title: 'Hang Power Clean',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Recepcion alta desde hang.',
                        'Torso firme y controlado.'
                    ]
                },
                SQUAT_SNATCH: {
                    title: 'Squat Snatch',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Codos bloqueados arriba en la recepcion.',
                        'Profundidad completa y estabilidad.'
                    ]
                },
                POWER_SNATCH: {
                    title: 'Power Snatch',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Recepcion alta con codos bloqueados.',
                        'Torso firme y controlado.'
                    ]
                },
                MUSCLE_SNATCH: {
                    title: 'Muscle Snatch',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Sin flexion de piernas, todo con brazos.',
                        'Codos bloqueados arriba.'
                    ]
                },
                HANG_SNATCH: {
                    title: 'Hang Snatch',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Inicio desde hang, codos bloqueados.',
                        'Control de torso durante el tiron.'
                    ]
                },
                SPLIT_JERK: {
                    title: 'Split Jerk',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Bloqueo de codos en recepcion.',
                        'Espalda recta en el empuje.'
                    ]
                },
                PUSH_JERK: {
                    title: 'Push Jerk',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Recepcion mas compacta, codos bloqueados.',
                        'Espalda recta en el empuje.'
                    ]
                },
                PUSH_PRESS: {
                    title: 'Push Press',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Dip corto de piernas y empuje continuo.',
                        'Codos bloqueados arriba.'
                    ]
                },
                STRICT_PRESS: {
                    title: 'Strict Press',
                    items: [
                        'Perfil completo y brazos visibles.',
                        'Sin flexion de piernas.',
                        'Codos bloqueados arriba.'
                    ]
                },
                DEADLIFT: {
                    title: 'Deadlift (Peso Muerto)',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Espalda recta durante todo el movimiento.',
                        'Barra visible desde el suelo.'
                    ]
                },
                CLEAN_PULL: {
                    title: 'Clean Pull',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Espalda recta durante el tiron.',
                        'Extension completa al final.'
                    ]
                },
                SNATCH_PULL: {
                    title: 'Snatch Pull',
                    items: [
                        'Perfil completo y cuerpo entero visible.',
                        'Espalda recta durante el tiron.',
                        'Extension completa al final.'
                    ]
                }
            },

            video: document.getElementById('inputVideo'),
            canvas: document.getElementById('outputCanvas'),
            ctx: document.getElementById('outputCanvas').getContext('2d', { alpha: true, desynchronized: true }),
            
            init: function() {
                try {
                    // Initialize DB for mobile storage
                    if (isMobile) DBHelper.init().catch(e => console.warn('DB init:', e));
                    if (isMobile) this.targetFps = 24;
                    
                    this.pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
                    this.configurePose('AI');
                    this.pose.onResults(this.onPoseResults.bind(this));
                    this.hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
                    this.configureHands();
                    this.hands.onResults(this.onHandsResults.bind(this));
                    this.setupPanEvents('wrapTop', 'top'); this.setupPanEvents('wrapBot', 'bot');
                    document.getElementById('vidTop').ontimeupdate = () => this.updateSeekUI('top');
                    document.getElementById('vidBot').ontimeupdate = () => this.updateSeekUI('bot');
                    const exerciseSelect = document.getElementById('exerciseSelect');
                    if (exerciseSelect) {
                        exerciseSelect.addEventListener('change', () => this.updateExerciseGuide());
                    }
                    this.syncSettingsUI();
                    this.updateCameraToggleLabel();
                    this.video.onplay = () => this.startProcessing();
                    this.video.onpause = () => this.stopProcessing();
                    this.video.onended = () => {
                        this.stopProcessing();
                        this.setMainPlayIcons(false);
                        if (this.isRecording) {
                            this.isRecording = false;
                            const btn = document.getElementById('recInnerAI');
                            if (btn) { btn.classList.replace('rounded-sm', 'rounded-full'); btn.classList.remove('scale-50'); }
                            document.getElementById('valPhase').innerText = "ANALIZANDO";
                            document.getElementById('valPhase').className = "font-bold text-xs uppercase mt-1 text-white";
                            setTimeout(() => this.analyzeLift(), 200);
                        }
                    };
                    
                    // Main video seek updater
                    this.video.ontimeupdate = () => {
                        const slider = document.getElementById('seekMain');
                        if (this.video.duration) slider.value = (this.video.currentTime / this.video.duration) * 100;
                    };
                    
                    // Prevent default pinch-zoom on mobile
                    document.addEventListener('gesturestart', (e) => e.preventDefault());
                    document.addEventListener('touchmove', (e) => {
                        if (e.touches.length > 1) e.preventDefault();
                    }, { passive: false });
                    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
                    window.addEventListener('pagehide', () => this.cleanupMedia());
                    window.addEventListener('beforeunload', () => this.cleanupMedia());
                } catch(e) { console.error(e); }
            },

            setMode: function(newMode) {
                this.mode = newMode;
                if (!this.audioCtx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtx) this.audioCtx = new AudioCtx();
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
                
                if (this.pose) this.configurePose(newMode);
                this.stopProcessing();
                this.stopCamera();
                this.revokeMainObjectUrl();
                this.pauseCompareVideos();
                this.barPath = [];
                this.frameData = [];
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                document.getElementById('mainMenu').classList.add('hide');
                document.getElementById('workspaceHeader').classList.remove('hide');
                document.getElementById('cameraWorkspace').classList.add('hide');
                document.getElementById('compareWorkspace').classList.add('hide');
                document.getElementById('exerciseSelectorWrapper').classList.add('hide');
                document.getElementById('guideToggleBtn').classList.add('hide');
                document.getElementById('aiSettingsToggleBtn').classList.add('hide');
                document.getElementById('cameraToggleBtn').classList.add('hide');
                document.getElementById('hudAI').classList.add('hide');
                document.getElementById('hudPath').classList.add('hide');
                document.getElementById('hudPathBottom').classList.add('hide');
                document.getElementById('bodyStatus').classList.add('hide');
                document.getElementById('exerciseGuide').classList.add('hide');
                document.getElementById('aiSettingsPanel').classList.add('hide');
                document.getElementById('workspaceTitle').innerText = { 'AI': 'Coach IA', 'PATH': 'Trayectoria', 'COMPARE': 'Comparador' }[newMode];

                if (newMode === 'AI' || newMode === 'PATH') {
                    document.getElementById('cameraWorkspace').classList.remove('hide');
                    document.getElementById('camStartOverlay').classList.remove('hide');
                    document.getElementById('aiVideoControls').classList.add('hide'); 
                    document.getElementById('pathVideoControls').classList.add('hide');
                    
                    // Reset video props
                    this.video.src = "";
                    this.video.load();
                    this.video.classList.remove('object-contain-video');
                    this.applyCameraMirror();
                    this.setMainPlayIcons(false);
                    
                    if (newMode === 'AI') {
                        document.getElementById('exerciseSelectorWrapper').classList.remove('hide');
                        document.getElementById('guideToggleBtn').classList.remove('hide');
                        document.getElementById('aiSettingsToggleBtn').classList.remove('hide');
                        document.getElementById('cameraToggleBtn').classList.remove('hide');
                        document.getElementById('camInstructions').innerText = "Coloca el móvil de perfil para medir ángulos.";
                    } else {
                        document.getElementById('cameraToggleBtn').classList.remove('hide');
                        document.getElementById('camInstructions').innerText = "Graba de perfil. La línea verde seguirá tus muñecas.";
                    }
                } else {
                    document.getElementById('compareWorkspace').classList.remove('hide');
                }
            },

            goHome: function() { this.cleanupMedia(); location.reload(); },

            openHelp: function() { window.location.href = "ayuda.html"; },

            updateExerciseGuide: function() {
                if (this.mode !== 'AI') return;
                const titleEl = document.getElementById('exerciseGuideTitle');
                const listEl = document.getElementById('exerciseGuideList');
                const selectEl = document.getElementById('exerciseSelect');
                if (!titleEl || !listEl || !selectEl) return;
                const guide = this.exerciseGuides[selectEl.value] || this.exerciseGuides.DEFAULT;
                titleEl.innerText = guide.title;
                listEl.innerHTML = '';
                guide.items.forEach((item) => {
                    const li = document.createElement('li');
                    li.innerText = item;
                    listEl.appendChild(li);
                });
            },

            toggleExerciseGuide: function() {
                if (this.mode !== 'AI') return;
                const panel = document.getElementById('exerciseGuide');
                const btn = document.getElementById('guideToggleBtn');
                if (!panel || !btn) return;
                const isHidden = panel.classList.contains('hide');
                if (isHidden) {
                    panel.classList.remove('hide');
                    this.updateExerciseGuide();
                    btn.classList.add('text-white');
                    btn.classList.remove('text-blue-300');
                } else {
                    panel.classList.add('hide');
                    btn.classList.remove('text-white');
                    btn.classList.add('text-blue-300');
                }
            },

            syncSettingsUI: function() {
                const g = document.getElementById('settingGestures');
                const s = document.getElementById('settingSound');
                const f = document.getElementById('settingFlash');
                if (g) g.checked = !!this.settings.gestureRecord;
                if (s) s.checked = !!this.settings.soundConfirm;
                if (f) f.checked = !!this.settings.flashConfirm;
            },

            setSetting: function(key, value) {
                if (!this.settings.hasOwnProperty(key)) return;
                this.settings[key] = !!value;
                if (key === 'gestureRecord' && !this.settings[key]) {
                    this.gestureState.holdFrames = 0;
                    this.cancelGestureCountdown();
                }
                this.syncSettingsUI();
            },

            toggleAiSettings: function() {
                if (this.mode !== 'AI') return;
                const panel = document.getElementById('aiSettingsPanel');
                const btn = document.getElementById('aiSettingsToggleBtn');
                if (!panel || !btn) return;
                const isHidden = panel.classList.contains('hide');
                if (isHidden) {
                    panel.classList.remove('hide');
                    this.syncSettingsUI();
                    btn.classList.add('text-white');
                    btn.classList.remove('text-gray-300');
                } else {
                    panel.classList.add('hide');
                    btn.classList.remove('text-white');
                    btn.classList.add('text-gray-300');
                }
            },

            confirmFeedback: function(type) {
                if (this.settings.soundConfirm) this.playBeep(type === 'start' ? 880 : 440);
                if (this.settings.flashConfirm) this.flashFeedback();
            },

            confirmTick: function() {
                if (this.settings.soundConfirm) this.playBeep(660);
                if (this.settings.flashConfirm) this.flashFeedback();
            },

            confirmDouble: function() {
                if (this.settings.soundConfirm) {
                    this.playBeep(880);
                    setTimeout(() => this.playBeep(880), 140);
                }
                if (this.settings.flashConfirm) {
                    this.flashFeedback();
                    setTimeout(() => this.flashFeedback(), 140);
                }
            },

            playBeep: function(freq) {
                try {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (!AudioCtx) return;
                    if (!this.audioCtx) this.audioCtx = new AudioCtx();
                    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                    const ctx = this.audioCtx;
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    const now = ctx.currentTime;
                    o.type = 'sine';
                    o.frequency.value = freq;
                    g.gain.setValueAtTime(0.0001, now);
                    g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
                    o.connect(g); g.connect(ctx.destination);
                    o.start(now);
                    o.stop(now + 0.18);
                } catch (e) {}
            },

            flashFeedback: function() {
                const doOverlay = () => {
                    const overlay = document.getElementById('flashOverlay');
                    if (!overlay) return;
                    overlay.classList.add('flash-on');
                    setTimeout(() => overlay.classList.remove('flash-on'), 120);
                };
                try {
                    const track = this.stream && this.stream.getVideoTracks ? this.stream.getVideoTracks()[0] : null;
                    if (track && track.getCapabilities && track.getCapabilities().torch) {
                        track.applyConstraints({ advanced: [{ torch: true }] })
                            .then(() => setTimeout(() => track.applyConstraints({ advanced: [{ torch: false }] }), 120))
                            .catch(() => doOverlay());
                        return;
                    }
                } catch (e) {}
                doOverlay();
            },

            onHandsResults: function(results) {
                if (!this.settings.gestureRecord) return;
                if (this.mode !== 'AI') return;
                if (!this.isCameraActive || !this.video || !this.video.srcObject) {
                    this.cancelGestureCountdown();
                    return;
                }
                const handLm = results && results.multiHandLandmarks ? results.multiHandLandmarks[0] : null;
                if (!handLm) {
                    this.gestureState.holdFrames = 0;
                    this.cancelGestureCountdown();
                    return;
                }
                const handedness = results && results.multiHandedness && results.multiHandedness[0]
                    ? results.multiHandedness[0].label
                    : null;
                this.detectGestureToggle(handLm, handedness);
            },

            detectGestureToggle: function(handLm, handedness) {
                if (!handLm) return;
                const now = performance.now();
                const fingers = this.getFingerState(handLm, handedness);
                const fingerCount = fingers.count;
                const openPalm = fingers.openPalm;
                const wrist = handLm[0];
                const isRaised = wrist && wrist.y < 0.9;
                if (!isRaised) {
                    this.gestureState.holdFrames = 0;
                    this.cancelGestureCountdown();
                    return;
                }
                if ((now - this.gestureState.lastToggleTime) < 1200) {
                    this.cancelGestureCountdown();
                    return;
                }
                if (openPalm) {
                    this.cancelGestureCountdown();
                    this.gestureState.holdFrames += 1;
                    if (this.gestureState.holdFrames >= 6 && (now - this.gestureState.lastToggleTime) > 1200) {
                        this.gestureState.holdFrames = 0;
                        this.gestureState.lastToggleTime = now;
                        this.toggleRecording();
                    }
                    return;
                }
                this.gestureState.holdFrames = 0;
                if (this.isRecording) {
                    this.cancelGestureCountdown();
                    return;
                }
                if (fingerCount >= 1) {
                    this.updateGestureCountdown(fingerCount, now);
                } else {
                    this.cancelGestureCountdown();
                }
            },

            updateGestureCountdown: function(targetCount, now) {
                const gs = this.gestureState.countdown;
                if (!gs.active || gs.target !== targetCount) {
                    gs.active = true;
                    gs.target = targetCount;
                    gs.startTime = now;
                    gs.lastTick = -1;
                }
                const elapsed = Math.floor((now - gs.startTime) / 1000);
                if (elapsed !== gs.lastTick && elapsed >= 1 && elapsed < gs.target) {
                    gs.lastTick = elapsed;
                    this.confirmTick();
                }
                if (elapsed >= gs.target) {
                    gs.active = false;
                    gs.target = 0;
                    gs.startTime = 0;
                    gs.lastTick = -1;
                    this.gestureState.lastToggleTime = now;
                    this.toggleRecording({ skipConfirm: true, doubleConfirm: true });
                }
            },

            cancelGestureCountdown: function() {
                const gs = this.gestureState.countdown;
                gs.active = false;
                gs.target = 0;
                gs.startTime = 0;
                gs.lastTick = -1;
            },

            getFingerState: function(handLm, handedness) {
                const wrist = handLm[0];
                const thumbTip = handLm[4]; const thumbIp = handLm[3]; const thumbMcp = handLm[2];
                const indexTip = handLm[8]; const indexPip = handLm[6];
                const middleTip = handLm[12]; const middlePip = handLm[10];
                const ringTip = handLm[16]; const ringPip = handLm[14];
                const pinkyTip = handLm[20]; const pinkyPip = handLm[18];
                const indexExt = wrist && Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) + 0.02;
                const middleExt = wrist && Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) + 0.02;
                const ringExt = wrist && Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) > Math.hypot(ringPip.x - wrist.x, ringPip.y - wrist.y) + 0.02;
                const pinkyExt = wrist && Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > Math.hypot(pinkyPip.x - wrist.x, pinkyPip.y - wrist.y) + 0.02;
                let thumbExt = false;
                if (thumbTip && thumbMcp && wrist) {
                    const distTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
                    const distMcp = Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y);
                    thumbExt = distTip > distMcp + 0.02;
                }
                const count = [thumbExt, indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
                const openPalm = indexExt && middleExt && ringExt && pinkyExt && thumbExt;
                return { count, openPalm };
            },

            configurePose: function(mode) {
                const highPrecision = mode === 'AI' || mode === 'PATH';
                const complexity = isMobile ? (highPrecision ? 1 : 0) : (highPrecision ? 2 : 1);
                const minDetect = highPrecision ? 0.4 : 0.5;
                const minTrack = highPrecision ? 0.4 : 0.5;
                this.pose.setOptions({
                    modelComplexity: complexity,
                    smoothLandmarks: true,
                    minDetectionConfidence: minDetect,
                    minTrackingConfidence: minTrack
                });
            },

            setMainPlayIcons: function(isPlaying) {
                const main = document.getElementById('btnMainPlay');
                const path = document.getElementById('btnPathPlay');
                if (main) main.className = `fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`;
                if (path) path.className = `fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`;
            },

            updateCameraToggleLabel: function() {
                const label = document.getElementById('cameraToggleLabel');
                if (!label) return;
                label.innerText = this.cameraFacing === 'user' ? 'Frontal' : 'Trasera';
            },

            applyCameraMirror: function() {
                const isFront = this.cameraFacing === 'user';
                this.updateCameraToggleLabel();
                if (this.hands) {
                    try { this.hands.setOptions({ selfieMode: isFront }); } catch (e) {}
                }
                if (!this.video || !this.video.srcObject) return;
                if (isFront) {
                    this.video.classList.add('scale-x-[-1]');
                    this.canvas.classList.add('scale-x-[-1]');
                } else {
                    this.video.classList.remove('scale-x-[-1]');
                    this.canvas.classList.remove('scale-x-[-1]');
                }
            },

            toggleCameraFacing: function(restart) {
                this.cameraFacing = this.cameraFacing === 'user' ? 'environment' : 'user';
                this.applyCameraMirror();
                if (restart && this.isCameraActive) this.startCamera();
            },

            getCameraConstraints: function(useLow, forceExact) {
                const width = useLow ? 640 : (isMobile ? 720 : 1280);
                const height = useLow ? 480 : (isMobile ? 480 : 720);
                const facing = forceExact ? { exact: this.cameraFacing } : { ideal: this.cameraFacing };
                return {
                    video: {
                        facingMode: facing,
                        width: { ideal: width },
                        height: { ideal: height }
                    },
                    audio: false
                };
            },

            startProcessing: function() {
                if (this.isProcessing || !this.pose) return;
                this.isProcessing = true;
                requestAnimationFrame(this.processFrame.bind(this));
            },

            stopProcessing: function() {
                this.isProcessing = false;
                this.isProcessingFrame = false;
            },

            stopCamera: function() {
                if (this.stream) {
                    this.stream.getTracks().forEach((track) => track.stop());
                    this.stream = null;
                }
                if (this.video && this.video.srcObject) {
                    this.video.srcObject = null;
                }
                this.isCameraActive = false;
            },

            revokeMainObjectUrl: function() {
                if (this.currentObjectUrl) {
                    URL.revokeObjectURL(this.currentObjectUrl);
                    this.currentObjectUrl = null;
                }
            },

            revokeCompareObjectUrl: function(side) {
                if (this.compareObjectUrls[side]) {
                    URL.revokeObjectURL(this.compareObjectUrls[side]);
                    this.compareObjectUrls[side] = null;
                }
            },

            pauseCompareVideos: function() {
                const v1 = document.getElementById('vidTop');
                const v2 = document.getElementById('vidBot');
                if (v1) v1.pause();
                if (v2) v2.pause();
                const compareIcon = document.getElementById('btnComparePlayIcon');
                if (compareIcon) compareIcon.classList.replace('fa-pause', 'fa-play');
                const topIcon = document.getElementById('btnPlayTop');
                if (topIcon) topIcon.classList.replace('fa-pause', 'fa-play');
                const botIcon = document.getElementById('btnPlayBot');
                if (botIcon) botIcon.classList.replace('fa-pause', 'fa-play');
            },

            cleanupMedia: function() {
                this.stopProcessing();
                this.stopCamera();
                this.revokeMainObjectUrl();
                this.revokeCompareObjectUrl('top');
                this.revokeCompareObjectUrl('bot');
                if (this.video) {
                    this.video.pause();
                    this.video.src = "";
                    this.video.load();
                }
            },

            handleVisibilityChange: function() {
                this.isAppVisible = !document.hidden;
                if (!this.isAppVisible) {
                    if (this.video && !this.video.srcObject) this.video.pause();
                    this.stopProcessing();
                    this.pauseCompareVideos();
                    return;
                }
                if (this.mode === 'AI' || this.mode === 'PATH') {
                    if (this.video && this.video.srcObject) {
                        this.video.play();
                        this.startProcessing();
                    }
                }
            },

            startCamera: async function() {
                try {
                    this.stopCamera();
                    this.revokeMainObjectUrl();
                    let stream = null;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints(false, true));
                    } catch (e1) {
                        try {
                            stream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints(true, true));
                        } catch (e2) {
                            stream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints(false, false))
                                .catch(() => navigator.mediaDevices.getUserMedia(this.getCameraConstraints(true, false)));
                        }
                    }
                    this.stream = stream;
                    this.video.srcObject = stream; 
                    this.video.play(); 
                    this.isCameraActive = true;
                    
                    // Fix styling for camera
                    this.video.classList.remove('object-contain-video');
                    this.applyCameraMirror();
                    
                    document.getElementById('camStartOverlay').classList.add('hide');
                    if (this.mode === 'AI') document.getElementById('hudAI').classList.remove('hide');
                    if (this.mode === 'PATH') {
                        document.getElementById('hudPath').classList.remove('hide');
                        document.getElementById('hudPathBottom').classList.remove('hide');
                    }
                    this.startProcessing();
                } catch (e) { alert("Error: " + e.message); }
            },
            
            handleFileUpload: function(input) {
                const file = input.files[0];
                if(file) {
                    this.stopCamera();
                    this.revokeMainObjectUrl();
                    const url = URL.createObjectURL(file);
                    this.currentObjectUrl = url;
                    this.video.srcObject = null; this.video.src = url;
                    
                    // Fix styling for uploaded video
                    this.video.classList.remove('scale-x-[-1]'); 
                    this.canvas.classList.remove('scale-x-[-1]');
                    this.video.classList.remove('object-contain-video');
                    this.canvas.classList.remove('object-contain-video');
                    
                    document.getElementById('camStartOverlay').classList.add('hide');
                    
                    if (this.mode === 'AI') {
                        document.getElementById('hudAI').classList.remove('hide');
                        document.getElementById('aiVideoControls').classList.remove('hide'); // Show controls
                    }
                    if (this.mode === 'PATH') {
                        document.getElementById('hudPath').classList.remove('hide');
                        document.getElementById('hudPathBottom').classList.remove('hide');
                        document.getElementById('pathVideoControls').classList.remove('hide'); // Show controls
                    }
                    
                    this.video.onloadeddata = () => {
                        this.video.loop = false; 
                        this.video.currentTime = 0;
                        this.video.pause();
                        this.setMainPlayIcons(false);
                        const phaseEl = document.getElementById('valPhase');
                        if(phaseEl) { phaseEl.innerText = "LISTO PARA REPRODUCIR"; phaseEl.className = "font-bold text-xs uppercase mt-1 text-blue-300"; }
                    };
                    input.value = "";
                }
            },
            
            resetInput: function() {
                this.stopProcessing();
                this.stopCamera();
                this.revokeMainObjectUrl();
                this.video.pause();
                this.video.src = "";
                this.video.srcObject = null;
                this.video.load();
                this.video.classList.remove('object-contain-video');
                this.applyCameraMirror();
                this.setMainPlayIcons(false);

            calculateAngle: function(a, b, c) {
                const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
                let angle = Math.abs(radians * 180.0 / Math.PI);
                if (angle > 180.0) angle = 360 - angle;
                return angle;
            },

            toggleRecording: function(opts) {
                const skipConfirm = opts && opts.skipConfirm;
                const doubleConfirm = opts && opts.doubleConfirm;
                const btn = document.getElementById('recInnerAI');
                if (!this.isRecording) {
                    this.isRecording = true; this.frameData = [];
                    btn.classList.replace('rounded-full', 'rounded-sm'); btn.classList.add('scale-50');
                    document.getElementById('valPhase').innerText = "GRABANDO...";
                    document.getElementById('valPhase').className = "font-bold text-xs uppercase mt-1 text-red-500 animate-pulse";
                    if (!this.video.srcObject && this.video.paused) {
                        this.video.play();
                        this.startProcessing();
                        this.setMainPlayIcons(true);
                    }
                    if (!skipConfirm) this.confirmFeedback('start');
                    if (doubleConfirm) this.confirmDouble();
                } else {
                    this.isRecording = false;
                    btn.classList.replace('rounded-sm', 'rounded-full'); btn.classList.remove('scale-50');
                    document.getElementById('valPhase').innerText = "ANALIZANDO";
                    document.getElementById('valPhase').className = "font-bold text-xs uppercase mt-1 text-white";
                    if (!this.video.srcObject) {
                        this.video.pause();
                        this.stopProcessing();
                        this.setMainPlayIcons(false);
                    }
                    if (!skipConfirm) this.confirmFeedback('stop');
                    setTimeout(() => this.analyzeLift(), 200);
                }
            },

            configureHands: function() {
                if (!this.hands) return;
                this.hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 1,
                    selfieMode: this.cameraFacing === 'user',
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
            },

            analyzeLift: function() {
                try {
                    const type = document.getElementById('exerciseSelect').value;
                    let faults = []; let msg = ""; let score = 10;
                    
                    const isSquatVariant = type.includes('SQUAT') || type.includes('CLEAN') || type.includes('SNATCH');
                    const isPowerVariant = type.includes('POWER');
                    const isPush = type.includes('JERK') || type.includes('PRESS');
                    const isDeadlift = type.includes('DEADLIFT') || type.includes('PULL');

                    if (!this.frameData || this.frameData.length === 0) {
                        msg = "No se detectó movimiento. Asegúrate de estar en cuadro.";
                        score = 0;
                    } else if (this.frameData.length < 10) {
                        msg = "Video demasiado corto para analizar.";
                        score = 0;
                    } else {
                        const deepest = this.frameData.reduce((prev, curr) => prev.hipY > curr.hipY ? prev : curr);
                        if (isSquatVariant && !isPowerVariant && !isPush) {
                            if (deepest.kneeAngle > 105) {
                                faults.push({icon: 'fa-arrow-down', text: 'Falta Profundidad (No rompiste paralelo)', severity: 'high'});
                                score -= 4;
                            } else {
                                faults.push({icon: 'fa-check', text: 'Buena Profundidad', severity: 'good'});
                            }
                        }
                        if (isPowerVariant) {
                            if (deepest.kneeAngle < 90) {
                                faults.push({icon: 'fa-triangle-exclamation', text: 'Bajaste mucho para ser Power', severity: 'medium'});
                                score -= 3;
                            } else {
                                faults.push({icon: 'fa-bolt', text: 'Buena recepción alta (Power)', severity: 'good'});
                            }
                        }
                        if (isDeadlift || type.includes('CLEAN')) {
                            const minHipAngle = this.frameData.reduce((min, p) => p.hipAngle < min ? p.hipAngle : min, 180);
                            if (minHipAngle < 60) {
                                faults.push({icon: 'fa-person-falling', text: 'Torso Inclinado: Pecho colapsado', severity: 'medium'});
                                score -= 3;
                            } else {
                                faults.push({icon: 'fa-check', text: 'Espalda sólida', severity: 'good'});
                            }
                        }
                        if (isPush || type.includes('SNATCH') || type.includes('OH_SQUAT')) {
                            const maxElbow = this.frameData.reduce((max, p) => p.elbowAngle > max ? p.elbowAngle : max, 0);
                            if (maxElbow < 160) {
                                faults.push({icon: 'fa-xmark', text: 'Falta bloqueo de codos (Press out)', severity: 'high'});
                                score -= 3;
                            } else {
                                faults.push({icon: 'fa-check', text: 'Buen bloqueo de codos', severity: 'good'});
                            }
                        }
                        if (score >= 9) msg = "¡Técnica Excelente!";
                        else if (score >= 6) msg = "Buen intento, corrige los detalles.";
                        else msg = "Atención a la técnica. Baja el peso.";
                    }

                    document.getElementById('aiFeedbackText').innerText = msg;
                    document.getElementById('scoreText').innerText = Math.max(0, score);
                    const dashOffset = 226 - (226 * (Math.max(0, score)/10));
                    document.getElementById('scoreCircle').style.strokeDashoffset = dashOffset;
                    document.getElementById('scoreCircle').style.stroke = score < 5 ? '#ef4444' : (score < 8 ? '#eab308' : '#3b82f6');
                    const list = document.getElementById('aiFaultsList'); list.innerHTML = "";
                    if(faults.length === 0 && score > 0) {
                         list.innerHTML = `<div class="bg-green-900/30 p-3 rounded text-green-400 text-sm"><i class="fa-solid fa-star mr-2"></i>Sin errores graves detectados</div>`;
                    }
                    faults.forEach(f => { 
                        const color = f.severity === 'high' ? 'text-red-400' : (f.severity === 'good' ? 'text-green-400' : 'text-yellow-400');
                        list.innerHTML += `<div class="flex items-center gap-3 bg-gray-800/50 p-3 rounded-lg"><i class="fa-solid ${f.icon} ${color}"></i><span class="text-sm text-gray-300">${f.text}</span></div>`; 
                    });
                    document.getElementById('aiModal').classList.remove('hidden');
                    
                    // Save to local DB
                    if (isMobile) {
                        DBHelper.saveLift({
                            date: new Date().toISOString(),
                            type: type,
                            score: Math.max(0, score),
                            data: this.frameData
                        }).catch(e => console.warn('Save error:', e));
                    }
                } catch(e) { alert("Error en análisis: " + e.message); }
            },

            loadCompareVideo: function(side, input) {
                const file = input.files[0];
                if (!file) return;
                const vid = side === 'top' ? document.getElementById('vidTop') : document.getElementById('vidBot');
                const overlay = side === 'top' ? document.getElementById('overlayTop') : document.getElementById('overlayBot');
                this.revokeCompareObjectUrl(side);
                const url = URL.createObjectURL(file);
                this.compareObjectUrls[side] = url;
                vid.src = url;
                overlay.classList.add('hide');
                input.value = "";
            },

            updateSeekUI: function(id) {
                const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
                const slider = document.getElementById(id === 'top' ? 'seekTop' : 'seekBot');
                if (!vid.duration) return;
                slider.value = (vid.currentTime / vid.duration) * 100;
            },
            
            onSeekInput: function(id, val) {
                const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
                if (!vid.duration) return;
                const time = (val / 100) * vid.duration;
                vid.currentTime = time;
            },

            toggleZoom: function(id) {
                const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
                const icon = document.getElementById(id === 'top' ? 'iconZoomTop' : 'iconZoomBot');
                let z = this.zoomLevels[id];
                if (z === 1) z = 1.5; else if (z === 1.5) z = 2; else z = 1;
                this.zoomLevels[id] = z;
                if (z === 1) this.panOffsets[id] = {x:0, y:0};
                this.applyTransform(id);
                if (z === 1) icon.className = "fa-solid fa-magnifying-glass-plus text-xs";
                else icon.className = "fa-solid fa-magnifying-glass-minus text-xs text-blue-400";
            },

            toggleFlip: function(id) {
                const icon = document.getElementById(id === 'top' ? 'iconFlipTop' : 'iconFlipBot');
                this.flipStates[id] *= -1;
                this.applyTransform(id);
                icon.className = this.flipStates[id] === -1 ? "fa-solid fa-right-left text-xs text-blue-400" : "fa-solid fa-right-left text-xs";
            },

            applyTransform: function(id) {
                const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
                const z = this.zoomLevels[id];
                const f = this.flipStates[id];
                const p = this.panOffsets[id];
                vid.style.transform = `translate(${p.x}px, ${p.y}px) scale(${z}) scaleX(${f})`;
            },

            setupPanEvents: function(wrapperId, id) {
                const wrap = document.getElementById(wrapperId);
                const startDrag = (e) => {
                    if (this.zoomLevels[id] === 1) return;
                    e.preventDefault();
                    this.dragState.active = true; this.dragState.target = id;
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    this.dragState.startX = clientX; this.dragState.startY = clientY;
                    this.dragState.initialX = this.panOffsets[id].x; this.dragState.initialY = this.panOffsets[id].y;
                };
                const doDrag = (e) => {
                    if (!this.dragState.active || this.dragState.target !== id) return;
                    e.preventDefault();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    const dx = clientX - this.dragState.startX; const dy = clientY - this.dragState.startY;
                    this.panOffsets[id].x = this.dragState.initialX + dx;
                    this.panOffsets[id].y = this.dragState.initialY + dy;
                    this.applyTransform(id);
                };
                const endDrag = () => { this.dragState.active = false; this.dragState.target = null; };
                wrap.addEventListener('mousedown', startDrag); window.addEventListener('mousemove', doDrag); window.addEventListener('mouseup', endDrag);
                wrap.addEventListener('touchstart', startDrag, {passive: false}); window.addEventListener('touchmove', doDrag, {passive: false}); window.addEventListener('touchend', endDrag);
            },

            toggleComparePlay: function() {
                const v1 = document.getElementById('vidTop'); const v2 = document.getElementById('vidBot');
                const icon = document.getElementById('btnComparePlayIcon');
                if (v1.paused) {
                    v1.play(); v2.play(); icon.classList.replace('fa-play', 'fa-pause');
                } else {
                    v1.pause(); v2.pause(); icon.classList.replace('fa-pause', 'fa-play');
                }
            },
            
            toggleSinglePlay: function(id) {
                const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
                const icon = document.getElementById(id === 'top' ? 'btnPlayTop' : 'btnPlayBot');
                if (vid.paused) { vid.play(); icon.classList.replace('fa-play', 'fa-pause'); }
                else { vid.pause(); icon.classList.replace('fa-pause', 'fa-play'); }
            },
            
            seekSingle: function(id, seconds) {
                const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
                vid.currentTime += seconds;
            },

            toggleMaximize: function(targetId) {
                const topCon = document.getElementById('containerTop');
                const botCon = document.getElementById('containerBot');
                const iconTop = document.getElementById('iconMaxTop');
                const iconBot = document.getElementById('iconMaxBot');
                if (targetId === 'top') {
                    if (botCon.classList.contains('hide')) { botCon.classList.remove('hide'); iconTop.classList.replace('fa-compress', 'fa-expand'); }
                    else { botCon.classList.add('hide'); iconTop.classList.replace('fa-expand', 'fa-compress'); }
                } else {
                    if (topCon.classList.contains('hide')) { topCon.classList.remove('hide'); iconBot.classList.replace('fa-compress', 'fa-expand'); }
                    else { topCon.classList.add('hide'); iconBot.classList.replace('fa-expand', 'fa-compress'); }
                }
            },
            
            toggleLayout: function() {
                const grid = document.getElementById('compareGrid');
                const icon = document.getElementById('iconLayout');
                if (this.layoutMode === 'col') {
                    this.layoutMode = 'row';
                    grid.classList.remove('flex-col');
                    grid.classList.add('flex-row');
                    icon.classList.remove('fa-rotate-90'); 
                } else {
                    this.layoutMode = 'col';
                    grid.classList.remove('flex-row');
                    grid.classList.add('flex-col');
                    icon.classList.add('fa-rotate-90');
                }
            },

            setSpeed: function(val) {
                document.getElementById('vidTop').playbackRate = val;
                document.getElementById('vidBot').playbackRate = val;
            },

            seekCompare: function(seconds) {
                const v1 = document.getElementById('vidTop'); const v2 = document.getElementById('vidBot');
                v1.currentTime += seconds; v2.currentTime += seconds;
            }
        };

        app.init();
    