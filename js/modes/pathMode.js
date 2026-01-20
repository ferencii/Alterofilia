// pathMode.js - Modo de rastreo de trayectoria

const PathModeHandler = {
    barPath: [],

    activate() {
        UIManager.hideElements('cameraWorkspace', 'compareWorkspace', 'aiVideoControls', 'pathVideoControls', 'exerciseSelectorWrapper');
        UIManager.showElements('cameraWorkspace', 'camStartOverlay', 'hudPath', 'hudPathBottom');
        UIManager.setText('camInstructions', 'Graba de perfil. La línea verde seguirá tus muñecas.');
        this.barPath = [];
    },

    processFrame(landmarks, canvas, ctx) {
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        if (leftWrist.visibility > 0.5 && rightWrist.visibility > 0.5) {
            const x = (leftWrist.x + rightWrist.x) / 2 * canvas.width;
            const y = (leftWrist.y + rightWrist.y) / 2 * canvas.height;
            this.barPath.push({ x, y });
        }

        if (this.barPath.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.barPath[0].x, this.barPath[0].y);
            for (let i = 1; i < this.barPath.length; i++) {
                ctx.lineTo(this.barPath[i].x, this.barPath[i].y);
            }
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    },

    clearPath() {
        this.barPath = [];
    }
};
