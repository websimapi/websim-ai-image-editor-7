import { Editor } from './editor.js';
import { room } from './room.js';
import { showNotification } from './notifications.js';

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,
  currentTool: null,

  async processSelection(actionType, params = {}) {
    if (!this.current || !Editor.currentImage) {
      showNotification('Please make a selection first', 'error');
      return;
    }

    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    switch (actionType) {
      case 'fill':
        const color = document.getElementById('colorPicker').value;
        const [r, g, b] = this.hexToRgb(color);
        this.applyToSelection((pos) => {
          pixels[pos] = r;
          pixels[pos + 1] = g;
          pixels[pos + 2] = b;
        });
        break;

      case 'alpha':
        this.applyToSelection((pos) => {
          pixels[pos + 3] = 0;
        });
        break;

      case 'image':
        await this.fillWithGeneratedImage(params.prompt);
        return;
    }

    ctx.putImageData(imageData, 0, 0);
    Editor.originalImageData = imageData;
  },

  applyToSelection(callback) {
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i]) {
        callback(i * 4);
      }
    }
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  },

  clear() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(Editor.originalImageData, 0, 0);
  },

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-button').forEach(btn => 
      btn.classList.toggle('active', btn.id === `${tool}Tool`)
    );

    const canvas = document.getElementById('editCanvas');
    canvas.classList.toggle('magic-wand', tool === 'magicWand');

    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const sensitivityControl = document.getElementById('sensitivityControl');
    
    fillImagePrompt.style.display = tool === 'fillWithImage' ? 'flex' : 'none';
    sensitivityControl.style.display = tool === 'magicWand' ? 'flex' : 'none';
  },

  handleCanvasClick(e) {
    if (this.currentTool !== 'magicWand') return;

    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));

    if (!Selection.isShiftPressed && !Selection.isCtrlPressed) {
      Selection.current = null;
    }

    const sensitivity = parseInt(document.getElementById('sensitivitySlider').value);
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const newSelection = this.floodFillSelect(imageData, x, y, sensitivity);
    
    if (Selection.isShiftPressed) {
      // Add to selection
      if (Selection.current) {
        for (let i = 0; i < Selection.current.length; i++) {
          Selection.current[i] = Selection.current[i] || newSelection[i];
        }
      } else {
        Selection.current = newSelection;
      }
    } else if (Selection.isCtrlPressed) {
      // Subtract from selection
      if (Selection.current) {
        for (let i = 0; i < Selection.current.length; i++) {
          Selection.current[i] = Selection.current[i] && !newSelection[i];
        }
      }
    } else {
      // New selection
      Selection.current = newSelection;
    }

    this.drawSelectionOverlay();
  },

  floodFillSelect(imageData, startX, startY, tolerance) {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    const visited = new Uint8Array(width * height);
    const selected = new Uint8Array(width * height);
    const startPos = (startY * width + startX) * 4;
    
    // Get start pixel color
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];

    const queue = [[startX, startY]];
    const toleranceSquared = tolerance * tolerance;

    while (queue.length) {
      const [x, y] = queue.shift();
      const pos = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[pos]) {
        continue;
      }

      const pixelPos = pos * 4;
      const r = pixels[pixelPos];
      const g = pixels[pixelPos + 1];
      const b = pixels[pixelPos + 2];
      const a = pixels[pixelPos + 3];

      // Calculate color difference using weighted RGB values
      const colorDiffSquared = 
        Math.pow((r - startR) * 0.3, 2) + 
        Math.pow((g - startG) * 0.59, 2) + 
        Math.pow((b - startB) * 0.11, 2) + 
        Math.pow((a - startA) * 0.1, 2);

      if (colorDiffSquared <= toleranceSquared) {
        visited[pos] = 1;
        selected[pos] = 1;

        // Add neighbors to queue
        queue.push(
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1]
        );
      }
    }

    return selected;
  },

  drawSelectionOverlay() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(Editor.originalImageData, 0, 0);

    if (!this.current) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Create temporary canvas for marching ants effect
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw selection outline
    tempCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    tempCtx.fillRect(0, 0, width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        if (this.current[pos]) {
          tempCtx.clearRect(x, y, 1, 1);
          
          // Draw marching ants border for edge pixels
          const isEdge = 
            (x === 0 || !this.current[pos - 1]) ||
            (x === width - 1 || !this.current[pos + 1]) ||
            (y === 0 || !this.current[pos - width]) ||
            (y === height - 1 || !this.current[pos + width]);
          
          if (isEdge) {
            if ((x + y) % 2 === Math.floor(Date.now() / 100) % 2) {
              tempCtx.fillStyle = 'black';
              tempCtx.fillRect(x, y, 1, 1);
            } else {
              tempCtx.fillStyle = 'white';
              tempCtx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    }
    
    ctx.drawImage(tempCanvas, 0, 0);
    requestAnimationFrame(() => this.drawSelectionOverlay());
  },

  setupSensitivitySlider() {
    const slider = document.getElementById('sensitivitySlider');
    const value = document.getElementById('sensitivityValue');
    
    slider.addEventListener('input', (e) => {
      value.textContent = e.target.value;
    });
  },

  fillWithGeneratedImage(prompt) {
    if (!prompt) {
      showNotification('Please enter a prompt for the selected region', 'error');
      return;
    }

    const prefixSelect = document.getElementById('prefixPrompt');
    const suffixSelect = document.getElementById('suffixPrompt');
    const fullPrompt = `${prefixSelect.value}${prompt}${suffixSelect.value}`;

    try {
      const canvas = document.getElementById('editCanvas');
      const generatedImage = this.generateImage(fullPrompt);
      this.applyGeneratedImage(generatedImage, canvas);
      Editor.saveToGallery(canvas, fullPrompt);
      
      document.getElementById('fillImagePrompt').style.display = 'none';
    } catch (error) {
      console.error('Error in image fill:', error);
      showNotification('Failed to fill image. Please try again.', 'error');
    }
  },

  generateImage(prompt) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = prompt;
    });
  },

  applyGeneratedImage(generatedImage, canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Find bounds of selection
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const pos = y * canvas.width + x;
        if (this.current[pos]) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const selectionWidth = maxX - minX + 1;
    const selectionHeight = maxY - minY + 1;
      
    tempCanvas.width = selectionWidth;
    tempCanvas.height = selectionHeight;
      
    tempCtx.drawImage(generatedImage, 0, 0, selectionWidth, selectionHeight);
      
    const scaledImageData = tempCtx.getImageData(0, 0, selectionWidth, selectionHeight);
    const scaledPixels = scaledImageData.data;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const pos = y * canvas.width + x;
        if (this.current[pos]) {
          const scaledX = x - minX;
          const scaledY = y - minY;
          const scaledPos = (scaledY * selectionWidth + scaledX) * 4;
          const targetPos = pos * 4;
            
          pixels[targetPos] = scaledPixels[scaledPos];
          pixels[targetPos + 1] = scaledPixels[scaledPos + 1];
          pixels[targetPos + 2] = scaledPixels[scaledPos + 2];
          pixels[targetPos + 3] = scaledPixels[scaledPos + 3];
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    Editor.originalImageData = imageData;
  }
};

window.addEventListener('load', () => {
  Selection.setupSensitivitySlider();
});