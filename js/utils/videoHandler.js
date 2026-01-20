// videoHandler.js - Gestiona reproducción y carga de videos

const VideoHandler = {
    isCameraActive: false,

    async startCamera(videoElement) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: 1280,
                    height: 720
                },
                audio: false
            });
            videoElement.srcObject = stream;
            videoElement.play();
            this.isCameraActive = true;
            videoElement.classList.remove('object-contain-video');
            videoElement.classList.add('scale-x-[-1]');
            return true;
        } catch (e) {
            alert('Error: ' + e.message);
            return false;
        }
    },

    handleFileUpload(videoElement, file) {
        if (!file) return false;
        const url = URL.createObjectURL(file);
        videoElement.srcObject = null;
        videoElement.src = url;
        videoElement.classList.remove('scale-x-[-1]');
        videoElement.classList.add('object-contain-video');
        this.isCameraActive = false;
        return true;
    },

    resetVideo(videoElement, canvasElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.srcObject = null;
        if (canvasElement) {
            const ctx = canvasElement.getContext('2d');
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
        this.isCameraActive = false;
    },

    setPlaybackSpeed(videoElements, speed) {
        videoElements.forEach(vid => {
            if (vid) vid.playbackRate = speed;
        });
    }
};
