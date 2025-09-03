class ImagePatchMatcher {
  constructor() {
    this.canvas = document.querySelector("#mainCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.image = null;
    this.imageLoaded = false;
    this.scaleFactor = 1;

    this.selectedPatch = null;
    this.isSelecting = false;
    this.selectionStart = null;
    this.allMatches = [];
    this.filteredMatches = [];

    this.rotationIncrement = 15;
    this.matchThreshold = 0.7;
    this.showMatches = true;

    this.initializeEventListeners();
    this.updateUI();
  }

  initializeEventListeners() {
    const imageInput = document.querySelector("#imageInput");
    const rotationSlider = document.querySelector("#rotationIncrement");
    const thresholdSlider = document.querySelector("#matchThreshold");
    const showMatchesCheckbox = document.querySelector("#showMatches");
    const runMatchingButton = document.querySelector("#runMatching");
    const clearPatchButton = document.querySelector("#clearPatch");
    const resetButton = document.querySelector("#resetTool");
    const downloadButton = document.querySelector("#downloadResult");

    imageInput.addEventListener("change", (e) => this.handleImageUpload(e));
    rotationSlider.addEventListener("input", (e) => this.updateRotationIncrement(e));
    thresholdSlider.addEventListener("input", (e) => this.updateMatchThreshold(e));
    showMatchesCheckbox.addEventListener("change", (e) => this.toggleMatchDisplay(e));
    runMatchingButton.addEventListener("click", () => this.startMatching());
    clearPatchButton.addEventListener("click", () => this.clearPatch());
    resetButton.addEventListener("click", () => this.resetTool());
    downloadButton.addEventListener("click", () => this.downloadResult());

    this.canvas.addEventListener("mousedown", (e) => this.startSelection(e));
    this.canvas.addEventListener("mousemove", (e) => this.updateSelection(e));
    this.canvas.addEventListener("mouseup", (e) => this.endSelection(e));
  }

  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const img = new Image();
    img.addEventListener("load", () => {
      this.image = img;
      this.imageLoaded = true;
      this.resizeCanvasToImage();
      this.drawImage();
      this.clearPatch();
      this.updateInstructions("Drag to select a patch for matching");
      this.updateUI();
    });

    img.onerror = () => {
      alert("Error loading image. Please try a different file.");
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
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
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
      y: event.clientY - rect.top,
    };
    this.isSelecting = true;
    this.canvas.style.cursor = "crosshair";
  }

  updateSelection(event) {
    if (!this.isSelecting || !this.selectionStart) return;

    const rect = this.canvas.getBoundingClientRect();
    const currentPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    this.selectedPatch = {
      x: Math.min(this.selectionStart.x, currentPos.x),
      y: Math.min(this.selectionStart.y, currentPos.y),
      width: Math.abs(currentPos.x - this.selectionStart.x),
      height: Math.abs(currentPos.y - this.selectionStart.y),
    };

    this.drawImage();
  }

  endSelection(event) {
    if (!this.isSelecting) return;

    this.isSelecting = false;
    this.canvas.style.cursor = "default";

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

    this.ctx.strokeStyle = "#3498db";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(
      this.selectedPatch.x,
      this.selectedPatch.y,
      this.selectedPatch.width,
      this.selectedPatch.height,
    );
    this.ctx.setLineDash([]);
  }

  extractPatch(x, y, width, height, sourceCanvas = this.canvas) {
    const temporaryCanvas = document.createElement("canvas");
    const temporaryContext = temporaryCanvas.getContext("2d");

    temporaryCanvas.width = width;
    temporaryCanvas.height = height;

    const imageData = sourceCanvas.getContext("2d").getImageData(x, y, width, height);
    temporaryContext.putImageData(imageData, 0, 0);

    return temporaryCanvas;
  }

  rotatePatch(patchCanvas, angle) {
    if (angle === 0) {
      return patchCanvas;
    }

    const rotatedCanvas = document.createElement("canvas");
    const rotatedContext = rotatedCanvas.getContext("2d");

    const cos = Math.abs(Math.cos((angle * Math.PI) / 180));
    const sin = Math.abs(Math.sin((angle * Math.PI) / 180));
    const newWidth = Math.ceil(patchCanvas.width * cos + patchCanvas.height * sin);
    const newHeight = Math.ceil(patchCanvas.width * sin + patchCanvas.height * cos);

    rotatedCanvas.width = newWidth;
    rotatedCanvas.height = newHeight;

    rotatedContext.fillStyle = "rgba(128, 128, 128, 1)";
    rotatedContext.fillRect(0, 0, newWidth, newHeight);

    rotatedContext.translate(newWidth / 2, newHeight / 2);
    rotatedContext.rotate((angle * Math.PI) / 180);
    rotatedContext.drawImage(patchCanvas, -patchCanvas.width / 2, -patchCanvas.height / 2);

    return rotatedCanvas;
  }

  precomputePatchData(patch) {
    const patchData = patch.getContext("2d").getImageData(0, 0, patch.width, patch.height).data;
    const grayValues = new Float32Array(patchData.length / 4);
    let mean = 0;

    for (let index = 0; index < patchData.length; index += 4) {
      const gray = (patchData[index] + patchData[index + 1] + patchData[index + 2]) / 3;
      grayValues[index / 4] = gray;
      mean += gray;
    }

    mean /= grayValues.length;

    let variance = 0;
    for (const grayValue of grayValues) {
      const diff = grayValue - mean;
      variance += diff * diff;
    }

    return {
      grayValues,
      mean,
      stdDev: Math.sqrt(variance),
      width: patch.width,
      height: patch.height,
    };
  }

  normalizedCrossCorrelation(patchInfo, target, x, y) {
    if (x < 0 || y < 0 || x + patchInfo.width > target.width || y + patchInfo.height > target.height) {
      return -1;
    }

    try {
      const targetData = target.getContext("2d").getImageData(x, y, patchInfo.width, patchInfo.height).data;

      if (targetData.length / 4 !== patchInfo.grayValues.length) {
        return -1;
      }

      let meanTarget = 0;
      const pixelCount = patchInfo.grayValues.length;

      for (let index = 0; index < targetData.length; index += 4) {
        const targetGray = (targetData[index] + targetData[index + 1] + targetData[index + 2]) / 3;
        meanTarget += targetGray;
      }

      meanTarget /= pixelCount;

      let numerator = 0,
        denomTarget = 0;

      for (let index = 0; index < targetData.length; index += 4) {
        const targetGray = (targetData[index] + targetData[index + 1] + targetData[index + 2]) / 3;
        const patchGray = patchInfo.grayValues[index / 4];

        const patchDiff = patchGray - patchInfo.mean;
        const targetDiff = targetGray - meanTarget;

        numerator += patchDiff * targetDiff;
        denomTarget += targetDiff * targetDiff;
      }

      const denominator = patchInfo.stdDev * Math.sqrt(denomTarget);
      return denominator > 0 ? numerator / denominator : 0;
    } catch {
      return -1;
    }
  }

  async runMatching(onProgress = null) {
    if (!this.selectedPatch) {
      alert("Please select a patch first");
      return;
    }

    this.updateUI(true);
    const startTime = performance.now();

    this.allMatches = [];
    this.filteredMatches = [];

    const patchCanvas = this.extractPatch(
      this.selectedPatch.x,
      this.selectedPatch.y,
      this.selectedPatch.width,
      this.selectedPatch.height,
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

    const targetCanvas = document.createElement("canvas");
    targetCanvas.width = this.canvas.width;
    targetCanvas.height = this.canvas.height;
    const targetContext = targetCanvas.getContext("2d");
    targetContext.drawImage(this.canvas, 0, 0);

    const rotatedPatches = new Map();

    for (const angle of angles) {
      let rotatedPatch;
      rotatedPatch = angle === 0 ? patchCanvas : this.rotatePatch(patchCanvas, angle);

      const patchInfo = this.precomputePatchData(rotatedPatch);
      rotatedPatches.set(angle, { patch: rotatedPatch, info: patchInfo });
    }

    let totalOperations = 0;
    for (const [angle, { patch: rotatedPatch }] of rotatedPatches) {
      const maxY = this.canvas.height - rotatedPatch.height;
      const maxX = this.canvas.width - rotatedPatch.width;
      totalOperations += Math.ceil(maxY / stepY + 1) * Math.ceil(maxX / stepX + 1);
    }

    let completedOperations = 0;
    let lastProgressUpdate = performance.now();

    for (const [angle, { patch: rotatedPatch, info: patchInfo }] of rotatedPatches) {
      const maxY = this.canvas.height - rotatedPatch.height;
      const maxX = this.canvas.width - rotatedPatch.width;

      for (let y = 0; y <= maxY; y += stepY) {
        for (let x = 0; x <= maxX; x += stepX) {
          const correlation = this.normalizedCrossCorrelation(patchInfo, targetCanvas, x, y);
          completedOperations++;

          if (correlation >= 0.01) {
            let isDuplicate = false;
            for (const existingMatch of this.allMatches) {
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
              this.allMatches.push({
                x,
                y,
                width: rotatedPatch.width,
                height: rotatedPatch.height,
                correlation,
                angle,
              });
            }
          }

          if (onProgress && performance.now() - lastProgressUpdate >= 100) {
            const progress = completedOperations / totalOperations;
            const elapsed = performance.now() - startTime;
            const eta = elapsed > 0 ? elapsed / progress - elapsed : 0;

            await onProgress({
              progress,
              nMatches: this.allMatches.length,
              eta: Math.round(eta),
              completedOperations,
              totalOperations,
            });

            lastProgressUpdate = performance.now();
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      }
    }

    this.allMatches.sort((a, b) => b.correlation - a.correlation);
    this.filterMatches();

    if (this.allMatches.length > 0 && this.filteredMatches.length === 0) {
      const highestMatch = this.allMatches[0];
      const newThreshold = Math.max(0.01, highestMatch.correlation - 0.001);
      this.matchThreshold = newThreshold;

      const thresholdSlider = document.querySelector("#matchThreshold");
      const newSliderValue = Math.round(newThreshold * 100);
      thresholdSlider.value = newSliderValue;
      document.querySelector("#thresholdValue").textContent = newSliderValue;

      this.filterMatches();
    }

    const processingTime = performance.now() - startTime;
    document.querySelector("#processingTime").textContent = `${Math.round(processingTime)}ms`;
    document.querySelector("#totalMatches").textContent = this.allMatches.length;
    document.querySelector("#matchCount").textContent = this.filteredMatches.length;

    this.drawImage();
    this.updateUI(false);
  }

  hslFromRotationAndMatch(angle, correlation) {
    const hue = Math.round(angle);
    const saturation = 100;
    const lightness = Math.round(30 + correlation * 50);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  drawMatches() {
    if (this.filteredMatches.length === 0 || !this.showMatches) return;

    for (const match of this.filteredMatches) {
      const color = this.hslFromRotationAndMatch(match.angle, match.correlation);

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.8;
      this.ctx.strokeRect(match.x, match.y, match.width, match.height);

      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.2;
      this.ctx.fillRect(match.x, match.y, match.width, match.height);

      this.ctx.globalAlpha = 1;
    }
  }

  updateRotationIncrement(event) {
    this.rotationIncrement = Number.parseInt(event.target.value);
    document.querySelector("#rotationValue").textContent = this.rotationIncrement;
  }

  filterMatches() {
    this.filteredMatches = this.allMatches.filter((match) => match.correlation >= this.matchThreshold);
  }

  updateMatchThreshold(event) {
    this.matchThreshold = Number.parseFloat(event.target.value) / 100;
    document.querySelector("#thresholdValue").textContent = event.target.value;

    if (this.allMatches.length > 0) {
      this.filterMatches();
      document.querySelector("#matchCount").textContent = this.filteredMatches.length;
      this.drawImage();
    }
  }

  toggleMatchDisplay(event) {
    this.showMatches = event.target.checked;
    this.drawImage();
  }

  clearPatch() {
    this.selectedPatch = null;
    this.allMatches = [];
    this.filteredMatches = [];
    this.updatePatchInfo();
    this.updateUI();
    this.drawImage();
    document.querySelector("#matchCount").textContent = "0";
    document.querySelector("#totalMatches").textContent = "0";
    document.querySelector("#processingTime").textContent = "-";
  }

  resetTool() {
    this.image = null;
    this.imageLoaded = false;
    this.selectedPatch = null;
    this.allMatches = [];
    this.filteredMatches = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.updateInstructions("Upload an image to get started");
    this.updatePatchInfo();
    this.updateUI();
    document.querySelector("#imageInput").value = "";
    document.querySelector("#matchCount").textContent = "0";
    document.querySelector("#totalMatches").textContent = "0";
    document.querySelector("#processingTime").textContent = "-";
  }

  downloadResult() {
    if (!this.imageLoaded) return;

    const link = document.createElement("a");
    link.download = "patch-matching-result.png";
    link.href = this.canvas.toDataURL();
    link.click();
  }

  updatePatchInfo() {
    const patchInfo = document.querySelector("#patchInfo");
    patchInfo.textContent = this.selectedPatch
      ? `${Math.round(this.selectedPatch.x)}, ${Math.round(this.selectedPatch.y)} (${Math.round(this.selectedPatch.width)}×${Math.round(this.selectedPatch.height)})`
      : "No patch selected";
  }

  updateInstructions(text) {
    const instructions = document.querySelector("#instructions");
    if (instructions) {
      instructions.textContent = text;
      instructions.style.display = this.imageLoaded ? "none" : "block";
    }
  }

  async startMatching() {
    const progressContainer = document.querySelector("#progressContainer");
    const progressFill = document.querySelector("#progressFill");
    const progressPercent = document.querySelector("#progressPercent");
    const progressMatches = document.querySelector("#progressMatches");
    const progressETA = document.querySelector("#progressETA");

    progressContainer.style.display = "block";

    const onProgress = async ({ progress, nMatches, eta }) => {
      const percent = Math.round(progress * 100);
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressMatches.textContent = `${nMatches} matches`;

      progressETA.textContent = eta > 1000 ? `~${Math.round(eta / 1000)}s left` : "Almost done...";
    };

    try {
      await this.runMatching(onProgress);
    } finally {
      progressContainer.style.display = "none";
    }
  }

  updateUI(processing = false) {
    const runButton = document.querySelector("#runMatching");
    const clearButton = document.querySelector("#clearPatch");
    const downloadButton = document.querySelector("#downloadResult");

    runButton.disabled = !this.selectedPatch || processing;
    runButton.textContent = processing ? "Processing..." : "Run Matching";

    clearButton.disabled = !this.selectedPatch;
    downloadButton.disabled = !this.imageLoaded;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ImagePatchMatcher();
});
