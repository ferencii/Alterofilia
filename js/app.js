// app.js - Módulo principal y orquestador

const app = {
    mode: null,
    video: null,
    canvas: null,
    ctx: null,
    lastVideoWidth: 0,
    lastVideoHeight: 0,
    wasPlayingBeforeHide: false,

    async init() {
        try {
            // Obtener referencias al DOM cuando esté listo
            this.video = document.getElementById('inputVideo');
            this.canvas = document.getElementById('outputCanvas');
            this.ctx = this.canvas.getContext('2d');

            // Inicializar MediaPipe
            MediaPipeHandler.pose = await MediaPipeHandler.init();
            MediaPipeHandler.pose.onResults(this.onPoseResults.bind(this));

            // Configurar eventos de video
            this.setupVideoEvents();
            this.setupVisibilityHandling();

            // Configurar eventos de pan en videos de comparación
            CompareModeHandler.setupPanEvents('wrapTop', 'top');
            CompareModeHandler.setupPanEvents('wrapBot', 'bot');

            console.log('Aplicación inicializada correctamente');
        } catch (e) {
            console.error('Error en inicialización:', e);
        }
    },

    setupVideoEvents() {
        const vidTop = document.getElementById('vidTop');
        const vidBot = document.getElementById('vidBot');

        if (vidTop) {
            vidTop.ontimeupdate = () => CompareModeHandler.updateSeekUI('top');
        }
        if (vidBot) {
            vidBot.ontimeupdate = () => CompareModeHandler.updateSeekUI('bot');
        }

        this.video.ontimeupdate = () => {
            const slider = document.getElementById('seekMain');
            if (this.video.duration) {
                slider.value = (this.video.currentTime / this.video.duration) * 100;
            }
        };
    },

    setPerformanceMode(enabled) {
        document.body.classList.toggle('perf-mode', enabled);
    },

    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (!this.video) return;
            const hasSource = this.video.srcObject || this.video.src;
            if (!hasSource) return;

            if (document.hidden) {
                this.wasPlayingBeforeHide = !this.video.paused;
                if (this.wasPlayingBeforeHide) {
                    this.video.pause();
                    UIManager.replaceClass('btnMainPlay', 'fa-pause', 'fa-play');
                    UIManager.replaceClass('btnPathPlay', 'fa-pause', 'fa-play');
                }
            } else if (this.wasPlayingBeforeHide) {
                this.video.play().catch(() => {});
                UIManager.replaceClass('btnMainPlay', 'fa-play', 'fa-pause');
                UIManager.replaceClass('btnPathPlay', 'fa-play', 'fa-pause');
                this.wasPlayingBeforeHide = false;
            }
        });
    },

    setMode(newMode) {
        this.mode = newMode;
        UIManager.hideElements('mainMenu', 'exerciseSelectorWrapper');
        UIManager.showElements('workspaceHeader');

        UIManager.updateWorkspaceMode(newMode);

        if (newMode === 'AI') {
            AIModeHandler.activate(this.video, this.canvas);
        } else if (newMode === 'PATH') {
            PathModeHandler.activate();
        } else if (newMode === 'COMPARE') {
            CompareModeHandler.activate();
        }
    },

    goHome() {
        location.reload();
    },

    async startCamera() {
        const success = await VideoHandler.startCamera(this.video);
        if (success) {
            this.setPerformanceMode(true);
            UIManager.hideElements('camStartOverlay', 'aiVideoControls', 'pathVideoControls');
            if (this.mode === 'AI') UIManager.showElements('hudAI');
            if (this.mode === 'PATH') UIManager.showElements('hudPath', 'hudPathBottom');
            this.processFrame();
        }
    },

    handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        VideoHandler.handleFileUpload(this.video, file);
        UIManager.hideElements('camStartOverlay');
        this.setPerformanceMode(true);

        if (this.mode === 'AI') {
            UIManager.showElements('hudAI', 'aiVideoControls');
        }
        if (this.mode === 'PATH') {
            UIManager.showElements('hudPath', 'hudPathBottom', 'pathVideoControls');
        }

        this.video.onloadeddata = () => {
            this.video.loop = true;
            this.video.play();
            this.processFrame();
            const phaseEl = document.getElementById('valPhase');
            if (phaseEl) {
                phaseEl.innerText = 'DALE A GRABAR';
                phaseEl.className = 'font-bold text-xs uppercase mt-1 text-yellow-400 animate-pulse';
            }
        };
    },

    resetInput() {
        VideoHandler.resetVideo(this.video, this.canvas);
        this.setPerformanceMode(false);
        this.wasPlayingBeforeHide = false;
        UIManager.showElements('camStartOverlay');
        UIManager.hideElements('aiVideoControls', 'pathVideoControls');
        UIManager.setText('valPhase', 'Listo');
        PathModeHandler.clearPath();
    },

    toggleMainVideoPlay() {
        if (this.video.paused) {
            this.video.play();
            UIManager.replaceClass('btnMainPlay', 'fa-play', 'fa-pause');
            UIManager.replaceClass('btnPathPlay', 'fa-play', 'fa-pause');
        } else {
            this.video.pause();
            UIManager.replaceClass('btnMainPlay', 'fa-pause', 'fa-play');
            UIManager.replaceClass('btnPathPlay', 'fa-pause', 'fa-play');
        }
    },

    onSeekMain(val) {
        if (this.video.duration) {
            this.video.currentTime = (val / 100) * this.video.duration;
        }
    },

    processFrame() {
        if (this.video.paused || this.video.ended) {
            requestAnimationFrame(this.processFrame.bind(this));
            return;
        }
        MediaPipeHandler.pose.send({ image: this.video });
        requestAnimationFrame(this.processFrame.bind(this));
    },

    onPoseResults(results) {
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        if (!videoWidth || !videoHeight) return;
        if (videoWidth !== this.lastVideoWidth || videoHeight !== this.lastVideoHeight) {
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            this.lastVideoWidth = videoWidth;
            this.lastVideoHeight = videoHeight;
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const statusEl = document.getElementById('bodyStatus');
        if (!results.poseLandmarks) {
            if (statusEl) UIManager.toggleVisibility('bodyStatus', true);
            return;
        }
        if (statusEl) UIManager.toggleVisibility('bodyStatus', false);

        if (this.mode === 'AI') {
            MediaPipeHandler.drawPose(this.ctx, results.poseLandmarks);
            AIModeHandler.processFrame(results.poseLandmarks, this.canvas, this.ctx, this.video);
        } else if (this.mode === 'PATH') {
            PathModeHandler.processFrame(results.poseLandmarks, this.canvas, this.ctx);
        }
    },

    // Métodos de grabación AI
    toggleRecording() {
        AIModeHandler.toggleRecording();
    },

    // Métodos de Trayectoria
    clearPath() {
        PathModeHandler.clearPath();
    },

    // Métodos de Comparación
    loadCompareVideo(side, input) {
        CompareModeHandler.loadVideo(side, input.files[0]);
    },

    toggleZoom(id) {
        CompareModeHandler.toggleZoom(id);
    },

    toggleFlip(id) {
        CompareModeHandler.toggleFlip(id);
    },

    toggleComparePlay() {
        CompareModeHandler.toggleComparePlay();
    },

    toggleSinglePlay(id) {
        CompareModeHandler.toggleSinglePlay(id);
    },

    toggleMaximize(targetId) {
        CompareModeHandler.toggleMaximize(targetId);
    },

    toggleLayout() {
        CompareModeHandler.toggleLayout();
    },

    setSpeed(val) {
        CompareModeHandler.setSpeed(val);
    },

    seekCompare(seconds) {
        CompareModeHandler.seekCompare(seconds);
    },

    onSeekInput(id, val) {
        CompareModeHandler.onSeekInput(id, val);
    }
};

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
