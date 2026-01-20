// compareMode.js - Modo de comparación lado a lado

const CompareModeHandler = {
    zoomLevels: { top: 1, bot: 1 },
    flipStates: { top: 1, bot: 1 },
    panOffsets: { top: { x: 0, y: 0 }, bot: { x: 0, y: 0 } },
    dragState: { active: false, startX: 0, startY: 0, initialX: 0, initialY: 0, target: null },
    layoutMode: 'col',

    activate() {
        UIManager.hideElements('cameraWorkspace', 'compareWorkspace', 'exerciseSelectorWrapper');
        UIManager.showElements('compareWorkspace');
        this.resetLayout();
    },

    loadVideo(side, file) {
        if (!file) return;
        const vid = side === 'top' ? document.getElementById('vidTop') : document.getElementById('vidBot');
        const overlay = side === 'top' ? document.getElementById('overlayTop') : document.getElementById('overlayBot');
        vid.src = URL.createObjectURL(file);
        overlay.classList.add('hide');
    },

    toggleZoom(id) {
        const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
        const icon = document.getElementById(id === 'top' ? 'iconZoomTop' : 'iconZoomBot');
        let z = this.zoomLevels[id];

        if (z === 1) z = 1.5;
        else if (z === 1.5) z = 2;
        else z = 1;

        this.zoomLevels[id] = z;
        if (z === 1) this.panOffsets[id] = { x: 0, y: 0 };
        this.applyTransform(id);

        if (z === 1) {
            icon.className = 'fa-solid fa-magnifying-glass-plus text-xs';
        } else {
            icon.className = 'fa-solid fa-magnifying-glass-minus text-xs text-blue-400';
        }
    },

    toggleFlip(id) {
        const icon = document.getElementById(id === 'top' ? 'iconFlipTop' : 'iconFlipBot');
        this.flipStates[id] *= -1;
        this.applyTransform(id);
        icon.className = this.flipStates[id] === -1
            ? 'fa-solid fa-right-left text-xs text-blue-400'
            : 'fa-solid fa-right-left text-xs';
    },

    applyTransform(id) {
        const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
        const z = this.zoomLevels[id];
        const f = this.flipStates[id];
        const p = this.panOffsets[id];
        vid.style.transform = `translate(${p.x}px, ${p.y}px) scale(${z}) scaleX(${f})`;
    },

    setupPanEvents(wrapperId, id) {
        const wrap = document.getElementById(wrapperId);
        const startDrag = (e) => {
            if (this.zoomLevels[id] === 1) return;
            e.preventDefault();
            this.dragState.active = true;
            this.dragState.target = id;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.dragState.startX = clientX;
            this.dragState.startY = clientY;
            this.dragState.initialX = this.panOffsets[id].x;
            this.dragState.initialY = this.panOffsets[id].y;
        };

        const doDrag = (e) => {
            if (!this.dragState.active || this.dragState.target !== id) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - this.dragState.startX;
            const dy = clientY - this.dragState.startY;
            this.panOffsets[id].x = this.dragState.initialX + dx;
            this.panOffsets[id].y = this.dragState.initialY + dy;
            this.applyTransform(id);
        };

        const endDrag = () => {
            this.dragState.active = false;
            this.dragState.target = null;
        };

        wrap.addEventListener('mousedown', startDrag);
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', endDrag);
        wrap.addEventListener('touchstart', startDrag, { passive: false });
        window.addEventListener('touchmove', doDrag, { passive: false });
        window.addEventListener('touchend', endDrag);
    },

    toggleComparePlay() {
        const v1 = document.getElementById('vidTop');
        const v2 = document.getElementById('vidBot');
        const icon = document.getElementById('btnComparePlayIcon');

        if (v1.paused) {
            v1.play();
            v2.play();
            icon.classList.replace('fa-play', 'fa-pause');
        } else {
            v1.pause();
            v2.pause();
            icon.classList.replace('fa-pause', 'fa-play');
        }
    },

    toggleSinglePlay(id) {
        const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
        const icon = document.getElementById(id === 'top' ? 'btnPlayTop' : 'btnPlayBot');

        if (vid.paused) {
            vid.play();
            icon.classList.replace('fa-play', 'fa-pause');
        } else {
            vid.pause();
            icon.classList.replace('fa-pause', 'fa-play');
        }
    },

    toggleMaximize(targetId) {
        const topCon = document.getElementById('containerTop');
        const botCon = document.getElementById('containerBot');
        const iconTop = document.getElementById('iconMaxTop');
        const iconBot = document.getElementById('iconMaxBot');

        if (targetId === 'top') {
            if (botCon.classList.contains('hide')) {
                botCon.classList.remove('hide');
                iconTop.classList.replace('fa-compress', 'fa-expand');
            } else {
                botCon.classList.add('hide');
                iconTop.classList.replace('fa-expand', 'fa-compress');
            }
        } else {
            if (topCon.classList.contains('hide')) {
                topCon.classList.remove('hide');
                iconBot.classList.replace('fa-compress', 'fa-expand');
            } else {
                topCon.classList.add('hide');
                iconBot.classList.replace('fa-expand', 'fa-compress');
            }
        }
    },

    toggleLayout() {
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

    setSpeed(speed) {
        VideoHandler.setPlaybackSpeed([
            document.getElementById('vidTop'),
            document.getElementById('vidBot')
        ], speed);
    },

    seekCompare(seconds) {
        const v1 = document.getElementById('vidTop');
        const v2 = document.getElementById('vidBot');
        v1.currentTime += seconds;
        v2.currentTime += seconds;
    },

    updateSeekUI(id) {
        const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
        const slider = document.getElementById(id === 'top' ? 'seekTop' : 'seekBot');
        if (!vid.duration) return;
        slider.value = (vid.currentTime / vid.duration) * 100;
    },

    onSeekInput(id, val) {
        const vid = document.getElementById(id === 'top' ? 'vidTop' : 'vidBot');
        if (!vid.duration) return;
        const time = (val / 100) * vid.duration;
        vid.currentTime = time;
    },

    resetLayout() {
        this.zoomLevels = { top: 1, bot: 1 };
        this.flipStates = { top: 1, bot: 1 };
        this.panOffsets = { top: { x: 0, y: 0 }, bot: { x: 0, y: 0 } };
        this.layoutMode = 'col';
        this.applyTransform('top');
        this.applyTransform('bot');
    }
};
