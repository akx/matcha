class ImagePatchMatcher {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = null;
        this.imageLoaded = false;
        this.scaleFactor = 1;
        
        this.selectedPatch = null;
        this.isSelecting = false;
        this.selectionStart = null;
        this.matches = [];
        
        this.rotationIncrement = 15;
        this.matchThreshold = 0.7;
        this.showMatches = true;
        
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        const imageInput = document.getElementById('imageInput');
        const rotationSlider = document.getElementById('rotationIncrement');
        const thresholdSlider = document.getElementById('matchThreshold');
        const showMatchesCheckbox = document.getElementById('showMatches');
        const runMatchingBtn = document.getElementById('runMatching');
        const clearPatchBtn = document.getElementById('clearPatch');
        const resetBtn = document.getElementById('resetTool');
        const downloadBtn = document.getElementById('downloadResult');

        imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        rotationSlider.addEventListener('input', (e) => this.updateRotationIncrement(e));
        thresholdSlider.addEventListener('input', (e) => this.updateMatchThreshold(e));
        showMatchesCheckbox.addEventListener('change', (e) => this.toggleMatchDisplay(e));
        runMatchingBtn.addEventListener('click', () => this.runMatching());
        clearPatchBtn.addEventListener('click', () => this.clearPatch());
        resetBtn.addEventListener('click', () => this.resetTool());
        downloadBtn.addEventListener('click', () => this.downloadResult());

        this.canvas.addEventListener('mousedown', (e) => this.startSelection(e));
        this.canvas.addEventListener('mousemove', (e) => this.updateSelection(e));
        this.canvas.addEventListener('mouseup', (e) => this.endSelection(e));
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            this.image = img;
            this.imageLoaded = true;
            this.resizeCanvasToImage();
            this.drawImage();
            this.clearPatch();
            this.updateInstructions('Drag to select a patch for matching');
            this.updateUI();
        };
        
        img.onerror = () => {
            alert('Error loading image. Please try a different file.');
        };

        img.src = URL.createObjectURL(file);
    }

    resizeCanvasToImage() {
        if (!this.image) return;
        
        const maxWidth = 800;
        const maxHeight = 600;
        
        const { width: originalWidth, height: originalHeight } = this.image;
        let { width, height } = this.image;
        
        if (width > maxWidth || height > maxHeight) {
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio);
            
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
            this.scaleFactor = ratio;
        } else {
            this.scaleFactor = 1;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
    }

    drawImage() {
        if (!this.image) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
        
        if (this.selectedPatch && this.showMatches) {
            this.drawMatches();
        }
        
        this.drawSelectionRectangle();
    }

    startSelection(event) {
        if (!this.imageLoaded) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.selectionStart = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        this.isSelecting = true;
        this.canvas.style.cursor = 'crosshair';
    }

    updateSelection(event) {
        if (!this.isSelecting || !this.selectionStart) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const currentPos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        this.selectedPatch = {
            x: Math.min(this.selectionStart.x, currentPos.x),
            y: Math.min(this.selectionStart.y, currentPos.y),
            width: Math.abs(currentPos.x - this.selectionStart.x),
            height: Math.abs(currentPos.y - this.selectionStart.y)
        };

        this.drawImage();
    }

    endSelection(event) {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        this.canvas.style.cursor = 'default';
        
        if (this.selectedPatch && this.selectedPatch.width > 5 && this.selectedPatch.height > 5) {
            this.updatePatchInfo();
            this.updateUI();
        } else {
            this.selectedPatch = null;
            this.updateUI();
        }
    }

    drawSelectionRectangle() {
        if (!this.selectedPatch) return;
        
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            this.selectedPatch.x,
            this.selectedPatch.y,
            this.selectedPatch.width,
            this.selectedPatch.height
        );
        this.ctx.setLineDash([]);
    }

    extractPatch(x, y, width, height, sourceCanvas = this.canvas) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        const imageData = sourceCanvas.getContext('2d').getImageData(x, y, width, height);
        tempCtx.putImageData(imageData, 0, 0);
        
        return tempCanvas;
    }

    rotatePatch(patchCanvas, angle) {
        if (angle === 0) {
            return patchCanvas;
        }
        
        const rotatedCanvas = document.createElement('canvas');
        const rotatedCtx = rotatedCanvas.getContext('2d');
        
        const cos = Math.abs(Math.cos(angle * Math.PI / 180));
        const sin = Math.abs(Math.sin(angle * Math.PI / 180));
        const newWidth = Math.ceil(patchCanvas.width * cos + patchCanvas.height * sin);
        const newHeight = Math.ceil(patchCanvas.width * sin + patchCanvas.height * cos);
        
        rotatedCanvas.width = newWidth;
        rotatedCanvas.height = newHeight;
        
        rotatedCtx.fillStyle = 'rgba(128, 128, 128, 1)';
        rotatedCtx.fillRect(0, 0, newWidth, newHeight);
        
        rotatedCtx.translate(newWidth / 2, newHeight / 2);
        rotatedCtx.rotate(angle * Math.PI / 180);
        rotatedCtx.drawImage(patchCanvas, -patchCanvas.width / 2, -patchCanvas.height / 2);
        
        return rotatedCanvas;
    }

    precomputePatchData(patch) {
        const patchData = patch.getContext('2d').getImageData(0, 0, patch.width, patch.height).data;
        const grayValues = new Float32Array(patchData.length / 4);
        let mean = 0;
        
        for (let i = 0; i < patchData.length; i += 4) {
            const gray = (patchData[i] + patchData[i + 1] + patchData[i + 2]) / 3;
            grayValues[i / 4] = gray;
            mean += gray;
        }
        
        mean /= grayValues.length;
        
        let variance = 0;
        for (let i = 0; i < grayValues.length; i++) {
            const diff = grayValues[i] - mean;
            variance += diff * diff;
        }
        
        return {
            grayValues,
            mean,
            stdDev: Math.sqrt(variance),
            width: patch.width,
            height: patch.height
        };
    }

    normalizedCrossCorrelation(patchInfo, target, x, y) {
        if (x < 0 || y < 0 || x + patchInfo.width > target.width || y + patchInfo.height > target.height) {
            return -1;
        }
        
        try {
            const targetData = target.getContext('2d').getImageData(x, y, patchInfo.width, patchInfo.height).data;
            
            if (targetData.length / 4 !== patchInfo.grayValues.length) {
                return -1;
            }
            
            let meanTarget = 0;
            const pixelCount = patchInfo.grayValues.length;
            
            for (let i = 0; i < targetData.length; i += 4) {
                const targetGray = (targetData[i] + targetData[i + 1] + targetData[i + 2]) / 3;
                meanTarget += targetGray;
            }
            
            meanTarget /= pixelCount;
            
            let numerator = 0, denomTarget = 0;
            
            for (let i = 0; i < targetData.length; i += 4) {
                const targetGray = (targetData[i] + targetData[i + 1] + targetData[i + 2]) / 3;
                const patchGray = patchInfo.grayValues[i / 4];
                
                const patchDiff = patchGray - patchInfo.mean;
                const targetDiff = targetGray - meanTarget;
                
                numerator += patchDiff * targetDiff;
                denomTarget += targetDiff * targetDiff;
            }
            
            const denominator = patchInfo.stdDev * Math.sqrt(denomTarget);
            return denominator > 0 ? numerator / denominator : 0;
        } catch (error) {
            return -1;
        }
    }

    async runMatching() {
        if (!this.selectedPatch) {
            alert('Please select a patch first');
            return;
        }

        this.updateUI(true);
        const startTime = Date.now();
        
        this.matches = [];
        
        const patchCanvas = this.extractPatch(
            this.selectedPatch.x,
            this.selectedPatch.y,
            this.selectedPatch.width,
            this.selectedPatch.height
        );
        
        const angles = [];
        if (this.rotationIncrement === 0) {
            angles.push(0);
        } else {
            for (let angle = 0; angle < 360; angle += this.rotationIncrement) {
                angles.push(angle);
            }
        }
        
        const stepX = Math.max(1, Math.floor(this.selectedPatch.width / 6));
        const stepY = Math.max(1, Math.floor(this.selectedPatch.height / 6));
        
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = this.canvas.width;
        targetCanvas.height = this.canvas.height;
        const targetCtx = targetCanvas.getContext('2d');
        targetCtx.drawImage(this.canvas, 0, 0);
        
        const rotatedPatches = new Map();
        
        for (const angle of angles) {
            let rotatedPatch;
            if (angle === 0) {
                rotatedPatch = patchCanvas;
            } else {
                rotatedPatch = this.rotatePatch(patchCanvas, angle);
            }
            
            const patchInfo = this.precomputePatchData(rotatedPatch);
            rotatedPatches.set(angle, { patch: rotatedPatch, info: patchInfo });
        }
        
        for (const [angle, { patch: rotatedPatch, info: patchInfo }] of rotatedPatches) {
            const maxY = this.canvas.height - rotatedPatch.height;
            const maxX = this.canvas.width - rotatedPatch.width;
            
            for (let y = 0; y <= maxY; y += stepY) {
                for (let x = 0; x <= maxX; x += stepX) {
                    const correlation = this.normalizedCrossCorrelation(patchInfo, targetCanvas, x, y);
                    
                    if (correlation >= this.matchThreshold) {
                        let isDuplicate = false;
                        for (const existingMatch of this.matches) {
                            const dx = Math.abs(existingMatch.x - x);
                            const dy = Math.abs(existingMatch.y - y);
                            if (dx < rotatedPatch.width * 0.5 && dy < rotatedPatch.height * 0.5) {
                                if (correlation > existingMatch.correlation) {
                                    existingMatch.x = x;
                                    existingMatch.y = y;
                                    existingMatch.correlation = correlation;
                                    existingMatch.angle = angle;
                                }
                                isDuplicate = true;
                                break;
                            }
                        }
                        
                        if (!isDuplicate) {
                            this.matches.push({
                                x,
                                y,
                                width: rotatedPatch.width,
                                height: rotatedPatch.height,
                                correlation,
                                angle
                            });
                        }
                    }
                }
            }
        }
        
        this.matches.sort((a, b) => b.correlation - a.correlation);
        
        const processingTime = Date.now() - startTime;
        document.getElementById('processingTime').textContent = `${processingTime}ms`;
        document.getElementById('matchCount').textContent = this.matches.length;
        
        this.drawImage();
        this.updateUI(false);
    }

    drawMatches() {
        if (!this.matches.length || !this.showMatches) return;
        
        this.matches.forEach(match => {
            let color;
            if (match.correlation >= 0.9) {
                color = '#e74c3c';
            } else if (match.correlation >= 0.8) {
                color = '#f39c12';
            } else {
                color = '#f1c40f';
            }
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.8;
            this.ctx.strokeRect(match.x, match.y, match.width, match.height);
            
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.2;
            this.ctx.fillRect(match.x, match.y, match.width, match.height);
            
            this.ctx.globalAlpha = 1.0;
        });
    }

    updateRotationIncrement(event) {
        this.rotationIncrement = parseInt(event.target.value);
        document.getElementById('rotationValue').textContent = this.rotationIncrement;
    }

    updateMatchThreshold(event) {
        this.matchThreshold = parseFloat(event.target.value) / 100;
        document.getElementById('thresholdValue').textContent = event.target.value;
        
        if (this.matches.length > 0) {
            this.drawImage();
        }
    }

    toggleMatchDisplay(event) {
        this.showMatches = event.target.checked;
        this.drawImage();
    }

    clearPatch() {
        this.selectedPatch = null;
        this.matches = [];
        this.updatePatchInfo();
        this.updateUI();
        this.drawImage();
        document.getElementById('matchCount').textContent = '0';
        document.getElementById('processingTime').textContent = '-';
    }

    resetTool() {
        this.image = null;
        this.imageLoaded = false;
        this.selectedPatch = null;
        this.matches = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateInstructions('Upload an image to get started');
        this.updatePatchInfo();
        this.updateUI();
        document.getElementById('imageInput').value = '';
        document.getElementById('matchCount').textContent = '0';
        document.getElementById('processingTime').textContent = '-';
    }

    downloadResult() {
        if (!this.imageLoaded) return;
        
        const link = document.createElement('a');
        link.download = 'patch-matching-result.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    updatePatchInfo() {
        const patchInfo = document.getElementById('patchInfo');
        if (this.selectedPatch) {
            patchInfo.textContent = `${Math.round(this.selectedPatch.x)}, ${Math.round(this.selectedPatch.y)} (${Math.round(this.selectedPatch.width)}×${Math.round(this.selectedPatch.height)})`;
        } else {
            patchInfo.textContent = 'No patch selected';
        }
    }

    updateInstructions(text) {
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.textContent = text;
            instructions.style.display = this.imageLoaded ? 'none' : 'block';
        }
    }

    updateUI(processing = false) {
        const runBtn = document.getElementById('runMatching');
        const clearBtn = document.getElementById('clearPatch');
        const downloadBtn = document.getElementById('downloadResult');
        
        runBtn.disabled = !this.selectedPatch || processing;
        runBtn.textContent = processing ? 'Processing...' : 'Run Matching';
        
        clearBtn.disabled = !this.selectedPatch;
        downloadBtn.disabled = !this.imageLoaded;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImagePatchMatcher();
});