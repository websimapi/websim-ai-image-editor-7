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

  async fillWithGeneratedImage(prompt) {
    if (!prompt) {
      showNotification('Please enter a prompt for the selected region', 'error');
      return;
    }

    const prefixSelect = document.getElementById('prefixPrompt');
    const suffixSelect = document.getElementById('suffixPrompt');
    const fullPrompt = `${prefixSelect.value}${prompt}${suffixSelect.value}`;

    try {
      const canvas = document.getElementById('editCanvas');
      const generatedImage = await this.generateImage(fullPrompt);
      await this.applyGeneratedImage(generatedImage, canvas);
      await Editor.saveToGallery(canvas, fullPrompt);
      
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

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  },

  clearSelection() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    if (canvas && Editor.originalImageData) {
      const ctx = canvas.getContext('2d');
      ctx.putImageData(Editor.originalImageData, 0, 0);
    }
  },

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-button').forEach(btn => 
      btn.classList.toggle('active', btn.id === `${tool}Tool`)
    );

    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const sensitivityControl = document.getElementById('sensitivityControl');
    
    fillImagePrompt.style.display = tool === 'fillWithImage' ? 'flex' : 'none';
    sensitivityControl.style.display = tool === 'magicWand' ? 'flex' : 'none';

    if (this.current) {
      switch (tool) {
        case 'fillSelection':
          this.processSelection('fill');
          break;
        case 'setAlpha':
          this.processSelection('alpha');
          break;
      }
    }
  },

  handleCanvasClick(e) {
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (!Selection.isShiftPressed && !Selection.isCtrlPressed) {
      Selection.current = null;
    }

    const sensitivity = parseInt(document.getElementById('sensitivitySlider').value);
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const newSelection = Selection.magicWandSelect(imageData, Math.round(x), Math.round(y), sensitivity);
    
    if (Selection.isShiftPressed || Selection.isCtrlPressed) {
      if (Selection.current) {
        for (let i = 0; i < Selection.current.length; i++) {
          Selection.current[i] = Selection.current[i] || newSelection[i];
        }
      } else {
        Selection.current = newSelection;
      }
    } else {
      Selection.current = newSelection;
    }

    Selection.drawOverlay();
  },

  magicWandSelect(imageData, startX, startY, tolerance) {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    const visited = new Uint8Array(width * height);
    const selected = new Uint8Array(width * height);
    const startPos = (startY * width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const stack = [[startX, startY]];
    
    while (stack.length) {
      const [x, y] = stack.pop();
      const pos = y * width + x;
      if (x < 0 || x >= width || y < 0 || y >= height || visited[pos]) {
        continue;
      }
      const pixelPos = pos * 4;
      const r = pixels[pixelPos];
      const g = pixels[pixelPos + 1];
      const b = pixels[pixelPos + 2];
      const colorDiff = Math.sqrt(Math.pow(r - startR, 2) + Math.pow(g - startG, 2) + Math.pow(b - startB, 2));
      if (colorDiff <= tolerance) {
        visited[pos] = 1;
        selected[pos] = 1;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
    return selected;
  },

  drawOverlay() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(Editor.originalImageData, 0, 0);
    if (!this.current) return;
    
    const width = canvas.width;
    const height = canvas.height;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        if (this.current[pos]) {
          const isEdge = x > 0 && !this.current[pos - 1] || 
                        x < width - 1 && !this.current[pos + 1] || 
                        y > 0 && !this.current[pos - width] || 
                        y < height - 1 && !this.current[pos + width];
          if (isEdge) {
            ctx.fillStyle = 'white';
            ctx.fillRect(x - 1, y - 1, 3, 3);
            ctx.strokeStyle = 'black';
            ctx.strokeRect(x - 1, y - 1, 3, 3);
          }
        }
      }
    }
  },

  async applyGeneratedImage(generatedImage, canvas) {
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
  },

  setupSensitivitySlider() {
    const slider = document.getElementById('sensitivitySlider');
    const value = document.getElementById('sensitivityValue');
    
    slider.addEventListener('input', (e) => {
      value.textContent = e.target.value;
      if (Selection.current) {
        Selection.drawOverlay();
      }
    });
  },
};

// Add slider initialization to the window load event
window.addEventListener('load', () => {
  Selection.setupSensitivitySlider();
});