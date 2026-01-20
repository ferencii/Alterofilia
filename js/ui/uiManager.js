// uiManager.js - Gestiona visibilidad y estado de componentes UI

const UIManager = {
    toggleVisibility(elementId, show) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (show) {
            el.classList.remove('hide');
        } else {
            el.classList.add('hide');
        }
    },

    hideElements(...elementIds) {
        elementIds.forEach(id => this.toggleVisibility(id, false));
    },

    showElements(...elementIds) {
        elementIds.forEach(id => this.toggleVisibility(id, true));
    },

    setText(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.innerText = text;
    },

    setClassNames(elementId, ...classNames) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = classNames.join(' ');
    },

    replaceClass(elementId, oldClass, newClass) {
        const el = document.getElementById(elementId);
        if (el) el.classList.replace(oldClass, newClass);
    },

    showMenu() {
        this.toggleVisibility('mainMenu', true);
        this.toggleVisibility('workspaceHeader', false);
        this.toggleVisibility('cameraWorkspace', false);
        this.toggleVisibility('compareWorkspace', false);
    },

    updateWorkspaceMode(mode) {
        const modeNames = {
            'AI': 'Coach IA',
            'PATH': 'Trayectoria',
            'COMPARE': 'Comparador'
        };
        this.setText('workspaceTitle', modeNames[mode] || 'MODO');
    }
};
