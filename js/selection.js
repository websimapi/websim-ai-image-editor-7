import { Editor } from './editor.js';
import { room } from './room.js';
import { showNotification } from './notifications.js';

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,
  currentTool: null,
  isDragging: false,
  lastX: null,
  lastY: null,

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

  drawOverlay() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    
    // Reset to original image first
    ctx.putImageData(Editor.originalImageData, 0, 0);
    
    if (!this.current) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Create a temporary canvas for the selection overlay
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayCtx = overlayCanvas.getContext('2d');
    
    // Draw selection outline on overlay canvas
    overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    overlayCtx.lineWidth = 1;
    
    // Find and draw edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        if (this.current[pos]) {
          const isEdge = 
            (x === 0 || !this.current[pos - 1]) || // left edge
            (x === width - 1 || !this.current[pos + 1]) || // right edge
            (y === 0 || !this.current[pos - width]) || // top edge
            (y === height - 1 || !this.current[pos + width]); // bottom edge
          
          if (isEdge) {
            overlayCtx.fillStyle = 'white';
            overlayCtx.fillRect(x, y, 1, 1);
            overlayCtx.strokeStyle = 'black';
            overlayCtx.strokeRect(x, y, 1, 1);
          }
        }
      }
    }
    
    // Composite the overlay onto the main canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(overlayCanvas, 0, 0);
  },

  handleCanvasClick(e) {
    const canvas = document.getElementById('editCanvas');
    
    if (e.type === 'mousedown') {
      Selection.isDragging = true;
      Selection.performSelection(e, canvas);
      canvas.addEventListener('mousemove', Selection.handleMouseMove);
      canvas.addEventListener('mouseup', Selection.handleMouseUp);
    }
  },

  handleMouseMove(e) {
    if (!Selection.isDragging) return;
    
    // Only perform selection if mouse has moved at least 2 pixels from last position
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
    
    if (Selection.lastX === null || Selection.lastY === null || 
        Math.abs(x - Selection.lastX) > 2 || Math.abs(y - Selection.lastY) > 2) {
      Selection.performSelection(e, canvas);
      Selection.lastX = x;
      Selection.lastY = y;
    }
  },

  handleMouseUp(e) {
    const canvas = document.getElementById('editCanvas');
    Selection.isDragging = false;
    Selection.lastX = null;
    Selection.lastY = null;
    canvas.removeEventListener('mousemove', Selection.handleMouseMove);
    canvas.removeEventListener('mouseup', Selection.handleMouseUp);
  },

  performSelection(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const sensitivity = parseInt(document.getElementById('sensitivitySlider').value);
    const imageData = Editor.originalImageData;
    const newSelection = Selection.magicWandSelect(imageData, Math.round(x), Math.round(y), sensitivity);
    
    if (Selection.isCtrlPressed) {
      if (Selection.current) {
        for (let i = 0; i < newSelection.length; i++) {
          if (newSelection[i]) {
            Selection.current[i] = 0;
          }
        }
      }
    } else {
      if (!Selection.current || (!Selection.isShiftPressed && !Selection.isDragging)) {
        Selection.current = new Uint8Array(canvas.width * canvas.height);
      }
      
      for (let i = 0; i < newSelection.length; i++) {
        Selection.current[i] |= newSelection[i];
      }
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

  async setAlpha() {
    await this.processSelection('alpha');
  },

  fillSelection() {
    this.processSelection('fill');
  },

  async fillWithImage(prompt) {
    await this.processSelection('image', { prompt });
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

  setTool(tool) {
    this.currentTool = tool;
    const canvas = document.getElementById('editCanvas');
    
    // Remove existing listeners
    canvas.removeEventListener('mousedown', this.handleCanvasClick);
    canvas.removeEventListener('mousemove', this.handleMouseMove);
    canvas.removeEventListener('mouseup', this.handleMouseUp);
    
    document.querySelectorAll('.tool-button').forEach(btn => 
      btn.classList.toggle('active', btn.id === `${tool}Tool`)
    );

    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const sensitivityControl = document.getElementById('sensitivityControl');
    
    fillImagePrompt.style.display = tool === 'fillWithImage' ? 'flex' : 'none';
    sensitivityControl.style.display = tool === 'magicWand' ? 'flex' : 'none';

    // Add mousedown listener for magic wand tool
    if (tool === 'magicWand') {
      canvas.addEventListener('mousedown', this.handleCanvasClick);
      canvas.classList.add('magic-wand');
    } else {
      canvas.classList.remove('magic-wand');
    }

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

  clearSelection() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    if (canvas && Editor.originalImageData) {
      const ctx = canvas.getContext('2d');
      ctx.putImageData(Editor.originalImageData, 0, 0);
    }
  }
};

// Add slider initialization to the window load event
window.addEventListener('load', () => {
  Selection.setupSensitivitySlider();
});