// aiCoach.js - Modo de análisis biomecánico con IA

const AIModeHandler = {
    isRecording: false,
    frameData: [],

    activate(videoElement, canvasElement) {
        UIManager.hideElements('cameraWorkspace', 'compareWorkspace', 'aiVideoControls', 'pathVideoControls');
        UIManager.showElements('cameraWorkspace', 'camStartOverlay', 'hudAI');
        UIManager.setText('camInstructions', 'Coloca el móvil de perfil para medir ángulos.');
        UIManager.showElements('exerciseSelectorWrapper');
        this.isRecording = false;
        this.frameData = [];
    },

    toggleRecording() {
        const btn = document.getElementById('recInnerAI');
        if (!this.isRecording) {
            this.isRecording = true;
            this.frameData = [];
            btn.classList.replace('rounded-full', 'rounded-sm');
            btn.classList.add('scale-50');
            UIManager.setText('valPhase', 'GRABANDO...');
            UIManager.setClassNames('valPhase', 'font-bold', 'text-xs', 'uppercase', 'mt-1', 'text-red-500', 'animate-pulse');
        } else {
            this.isRecording = false;
            btn.classList.replace('rounded-sm', 'rounded-full');
            btn.classList.remove('scale-50');
            UIManager.setText('valPhase', 'ANALIZANDO');
            UIManager.setClassNames('valPhase', 'font-bold', 'text-xs', 'uppercase', 'mt-1', 'text-white');
            setTimeout(() => this.analyzeLift(), 200);
        }
    },

    processFrame(landmarks, canvas, ctx, video) {
        const shoulder = landmarks[12];
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];

        if (hip && knee && ankle) {
            const kneeAngle = MediaPipeHandler.calculateAngle(hip, knee, ankle);
            const hipAngle = MediaPipeHandler.calculateAngle(shoulder, hip, knee);
            UIManager.setText('valKnee', Math.round(kneeAngle) + '°');
            UIManager.setText('valHip', Math.round(hipAngle) + '°');

            if (this.isRecording) {
                const elbow = landmarks[14];
                const wrist = landmarks[16];
                const elbowAngle = MediaPipeHandler.calculateAngle(shoulder, elbow, wrist);
                const data = { kneeAngle, hipAngle, hipY: hip.y, elbowAngle };
                this.frameData.push(data);

                const el = document.getElementById('liveFeedback');
                if (kneeAngle < 90) {
                    el.style.opacity = '1';
                    document.getElementById('feedbackText').innerText = '¡PROFUNDO!';
                } else {
                    el.style.opacity = '0';
                }
            }
        }
    },

    analyzeLift() {
        try {
            const type = document.getElementById('exerciseSelect').value;
            let faults = [];
            let msg = '';
            let score = 10;

            const isSquatVariant = type.includes('SQUAT') || type.includes('CLEAN') || type.includes('SNATCH');
            const isPowerVariant = type.includes('POWER');
            const isPush = type.includes('JERK') || type.includes('PRESS');
            const isDeadlift = type.includes('DEADLIFT') || type.includes('PULL');

            if (!this.frameData || this.frameData.length === 0) {
                msg = 'No se detectó movimiento. Asegúrate de estar en cuadro.';
                score = 0;
            } else if (this.frameData.length < 10) {
                msg = 'Video demasiado corto para analizar.';
                score = 0;
            } else {
                const deepest = this.frameData.reduce((prev, curr) => prev.hipY > curr.hipY ? prev : curr);

                if (isSquatVariant && !isPowerVariant && !isPush) {
                    if (deepest.kneeAngle > 105) {
                        faults.push({
                            icon: 'fa-arrow-down',
                            text: 'Falta Profundidad (No rompiste paralelo)',
                            severity: 'high'
                        });
                        score -= 4;
                    } else {
                        faults.push({
                            icon: 'fa-check',
                            text: 'Buena Profundidad',
                            severity: 'good'
                        });
                    }
                }

                if (isPowerVariant) {
                    if (deepest.kneeAngle < 90) {
                        faults.push({
                            icon: 'fa-triangle-exclamation',
                            text: 'Bajaste mucho para ser Power',
                            severity: 'medium'
                        });
                        score -= 3;
                    } else {
                        faults.push({
                            icon: 'fa-bolt',
                            text: 'Buena recepción alta (Power)',
                            severity: 'good'
                        });
                    }
                }

                if (isDeadlift || type.includes('CLEAN')) {
                    const minHipAngle = this.frameData.reduce((min, p) => p.hipAngle < min ? p.hipAngle : min, 180);
                    if (minHipAngle < 60) {
                        faults.push({
                            icon: 'fa-person-falling',
                            text: 'Torso Inclinado: Pecho colapsado',
                            severity: 'medium'
                        });
                        score -= 3;
                    } else {
                        faults.push({
                            icon: 'fa-check',
                            text: 'Espalda sólida',
                            severity: 'good'
                        });
                    }
                }

                if (isPush || type.includes('SNATCH') || type.includes('OH_SQUAT')) {
                    const maxElbow = this.frameData.reduce((max, p) => p.elbowAngle > max ? p.elbowAngle : max, 0);
                    if (maxElbow < 160) {
                        faults.push({
                            icon: 'fa-xmark',
                            text: 'Falta bloqueo de codos (Press out)',
                            severity: 'high'
                        });
                        score -= 3;
                    } else {
                        faults.push({
                            icon: 'fa-check',
                            text: 'Buen bloqueo de codos',
                            severity: 'good'
                        });
                    }
                }

                if (score >= 9) msg = '¡Técnica Excelente!';
                else if (score >= 6) msg = 'Buen intento, corrige los detalles.';
                else msg = 'Atención a la técnica. Baja el peso.';
            }

            UIManager.setText('aiFeedbackText', msg);
            UIManager.setText('scoreText', Math.max(0, score));
            const dashOffset = 226 - (226 * (Math.max(0, score) / 10));
            const scoreCircle = document.getElementById('scoreCircle');
            scoreCircle.style.strokeDashoffset = dashOffset;
            scoreCircle.style.stroke = score < 5 ? '#ef4444' : (score < 8 ? '#eab308' : '#3b82f6');

            const list = document.getElementById('aiFaultsList');
            list.innerHTML = '';
            if (faults.length === 0 && score > 0) {
                list.innerHTML = `<div class="bg-green-900/30 p-3 rounded text-green-400 text-sm"><i class="fa-solid fa-star mr-2"></i>Sin errores graves detectados</div>`;
            }
            faults.forEach(f => {
                const color = f.severity === 'high' ? 'text-red-400' : (f.severity === 'good' ? 'text-green-400' : 'text-yellow-400');
                list.innerHTML += `<div class="flex items-center gap-3 bg-gray-800/50 p-3 rounded-lg"><i class="fa-solid ${f.icon} ${color}"></i><span class="text-sm text-gray-300">${f.text}</span></div>`;
            });

            // Mostrar modal (usar classList porque usa clase 'hidden' de Tailwind)
            document.getElementById('aiModal').classList.remove('hidden');
        } catch (e) {
            alert('Error en análisis: ' + e.message);
        }
    }
};
