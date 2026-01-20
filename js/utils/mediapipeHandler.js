// mediapipeHandler.js - Gestiona inicialización y configuración de MediaPipe

const MediaPipeHandler = {
    pose: null,

    async init() {
        try {
            this.pose = new Pose({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
            });
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const isLowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4)
                || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
            const modelComplexity = (isMobile || isLowPower) ? 0 : 1;
            this.pose.setOptions({
                modelComplexity,
                smoothLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            return this.pose;
        } catch (e) {
            console.error('Error inicializando MediaPipe:', e);
            throw e;
        }
    },

    calculateAngle(a, b, c) {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    },

    drawPose(ctx, landmarks) {
        drawConnectors(ctx, landmarks, POSE_CONNECTIONS, {
            color: 'rgba(255,255,255,0.2)',
            lineWidth: 2
        });
    }
};
