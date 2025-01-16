import { Editor } from './editor.js';
import { room } from './room.js';
import { showNotification } from './notifications.js';

class MagicWand {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.tolerance = 32;
    this.imageData = null;
    this.width = 0;
    this.height = 0;
    this.pixelData = null;
  }

  cacheImageData() {
    this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.pixelData = this.imageData.data;
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const i = (y * this.width + x) * 4;
    return {
      r: this.pixelData[i],
      g: this.pixelData[i + 1],
      b: this.pixelData[i + 2],
      a: this.pixelData[i + 3]
    };
  }

  colorDifference(color1, color2) {
    return Math.abs(color1.r - color2.r) +
           Math.abs(color1.g - color2.g) +
           Math.abs(color1.b - color2.b);
  }

  select(startX, startY) {
    this.cacheImageData();

    const mask = new Uint8Array(this.width * this.height);
    const startColor = this.getPixel(startX, startY);
    
    const queue = new Int32Array(this.width * this.height * 2);
    let queueLength = 2;
    queue[0] = startX;
    queue[1] = startY;
    
    const dx = [-1, 1, 0, 0];
    const dy = [0, 0, -1, 1];

    mask[startY * this.width + startX] = 1;

    while (queueLength > 0) {
      queueLength -= 2;
      const x = queue[queueLength];
      const y = queue[queueLength + 1];

      for (let d = 0; d < 4; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];

        if (nx >= 0 && nx < this.width && 
            ny >= 0 && ny < this.height && 
            !mask[ny * this.width + nx]) {
          
          const currentColor = this.getPixel(nx, ny);
          const colorDiff = this.colorDifference(startColor, currentColor);

          if (colorDiff <= this.tolerance * 3) { 
            mask[ny * this.width + nx] = 1;
            queue[queueLength] = nx;
            queue[queueLength + 1] = ny;
            queueLength += 2;
          }
        }
      }
    }

    return mask;
  }
}

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,
  magicWand: null,
  selectionStartTime: 0,
  zoom: 1,
  panX: 0,  
  panY: 0,
  isPanning: false,
  lastMouseX: 0,
  lastMouseY: 0,
  selectedTool: null,

  setTool(tool) {
    const canvas = document.getElementById('editCanvas');
    if (!this.magicWand) {
      this.magicWand = new MagicWand(canvas);
    }
    
    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const sensitivityControl = document.getElementById('sensitivityControl');
    
    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
    
    const toolButton = document.getElementById(`${tool}Tool`);
    if (toolButton) {
      toolButton.classList.add('active');
    }

    sensitivityControl.style.display = tool === 'magicWand' ? 'flex' : 'none';
    if (tool === 'magicWand') {
      this.magicWand.tolerance = parseInt(document.getElementById('sensitivitySlider').value);
    }

    if (tool === 'fillSelection' && this.current) {
      fillImagePrompt.style.display = 'none';
      this.fillSelection();
    } else if (tool === 'setAlpha' && this.current) {
      fillImagePrompt.style.display = 'none';
      this.setAlpha();
    } else if (tool === 'fillWithImage' && this.current) {
      fillImagePrompt.style.display = 'flex';
    } else {
      fillImagePrompt.style.display = 'none';
      canvas.style.cursor = tool === 'magicWand' ? 'crosshair' : 'default';
    }
    
    this.selectedTool = tool;
  },

  toggleFullscreen() {
    const container = document.getElementById('editorContainer');
    container.classList.toggle('fullscreen');
    this.updateCanvasView();
  },

  updateCanvasView() {
    const canvas = document.getElementById('editCanvas');
    const container = document.getElementById('editorContainer');
    
    if (container.classList.contains('fullscreen')) {
      canvas.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
    } else {
      canvas.style.transform = 'none';
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    }
  },

  handleZoom(event) {
    if (event.deltaY < 0) {
      this.zoom = Math.min(this.zoom * 1.1, 5);
    } else {
      this.zoom = Math.max(this.zoom / 1.1, 0.1);
    }
    this.updateCanvasView();
    event.preventDefault();
  },

  startPan(event) {
    this.isPanning = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  },

  handlePan(event) {
    if (!this.isPanning) return;
    
    const dx = event.clientX - this.lastMouseX;
    const dy = event.clientY - this.lastMouseY;
    
    this.panX += dx / this.zoom;
    this.panY += dy / this.zoom;
    
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    
    this.updateCanvasView();
  },

  stopPan() {
    this.isPanning = false;
  },

  handleCanvasClick(e) {
    const now = Date.now();
    if (now - Selection.selectionStartTime < 100) return;
    Selection.selectionStartTime = now;

    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Adjust coordinates for zoom and pan
    const x = Math.round((e.clientX - rect.left) * scaleX / Selection.zoom - Selection.panX);
    const y = Math.round((e.clientY - rect.top) * scaleY / Selection.zoom - Selection.panY);

    if (!Selection.magicWand) {
      Selection.magicWand = new MagicWand(canvas);
    }

    Selection.magicWand.tolerance = parseInt(document.getElementById('sensitivitySlider').value);

    if (Selection.isCtrlPressed) {
      // Handle deselection
      if (Selection.current) {
        const deselection = Selection.magicWand.select(x, y);
        for (let i = 0; i < Selection.current.length; i++) {
          if (deselection[i]) {
            Selection.current[i] = 0;
          }
        }
      }
    } else if (!Selection.isShiftPressed) {
      Selection.current = null;
    }

    requestAnimationFrame(() => {
      const newSelection = Selection.magicWand.select(x, y);
      
      if (Selection.isShiftPressed) {
        if (Selection.current) {
          for (let i = 0; i < Selection.current.length; i++) {
            Selection.current[i] = Selection.current[i] || newSelection[i];
          }
        } else {
          Selection.current = newSelection;
        }
      } else if (!Selection.isCtrlPressed) {
        Selection.current = newSelection;
      }

      Selection.drawOverlay();
    });
  },

  drawOverlay() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(Editor.originalImageData, 0, 0);
    
    if (!this.current) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayCtx = overlayCanvas.getContext('2d');
    const overlayData = overlayCtx.createImageData(width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        if (this.current[pos]) {
          const isEdge = 
            x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
            !this.current[pos - 1] || !this.current[pos + 1] ||
            !this.current[pos - width] || !this.current[pos + width];
            
          if (isEdge) {
            const i = pos * 4;
            overlayData.data[i] = 255;     // R
            overlayData.data[i + 1] = 255; // G
            overlayData.data[i + 2] = 255; // B
            overlayData.data[i + 3] = 255; // A
          }
        }
      }
    }
    
    overlayCtx.putImageData(overlayData, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);
  },

  fillSelection() {
    if (!this.current) return;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const color = document.getElementById('colorPicker').value;
    const r = parseInt(color.substr(1,2), 16);
    const g = parseInt(color.substr(3,2), 16);
    const b = parseInt(color.substr(5,2), 16);
    
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i]) {
        const pos = i * 4;
        pixels[pos] = r;
        pixels[pos + 1] = g;
        pixels[pos + 2] = b;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    Editor.originalImageData = imageData;
  },

  setAlpha() {
    if (!this.current) return;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i]) {
        pixels[i * 4 + 3] = 0;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    Editor.originalImageData = imageData;
  },

  clearSelection() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (Editor.originalImageData) {
      ctx.putImageData(Editor.originalImageData, 0, 0);
    }
  },

  async fillWithImage(prompt) {
    if (!this.current || !Editor.currentImage) {
      showNotification('Please make a selection first', 'error');
      return;
    }
    
    prompt = Editor.sanitizePrompt(prompt);
    
    if (!prompt) {
      showNotification('Please enter a prompt for the selected region', 'error');
      return;
    }

    const prefixSelect = document.getElementById('prefixPrompt');
    const suffixSelect = document.getElementById('suffixPrompt');
    const fullPrompt = `${prefixSelect.value}${prompt}${suffixSelect.value}`;

    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.style.display = 'block';

    const generatedImage = document.createElement('img');
    generatedImage.crossOrigin = 'anonymous';
    generatedImage.style.display = 'none';
    generatedImage.dataset.freshFill = 'true';
    
    generatedImage.src = fullPrompt;
    generatedImage.alt = fullPrompt;

    generatedImage.onload = async () => {
      if (generatedImage.dataset.freshFill !== 'true') return;
      generatedImage.dataset.freshFill = 'false';
      
      loadingSpinner.style.display = 'none';
      
      const canvas = document.getElementById('editCanvas');
      const ctx = canvas.getContext('2d');

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
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const pos = y * canvas.width + x;
          if (this.current[pos]) {
            const scaledX = x - minX;
            const scaledY = y - minY;
            const scaledPos = (scaledY * selectionWidth + scaledX) * 4;
            const targetPos = pos * 4;
            
            pixels[targetPos] = scaledImageData.data[scaledPos];
            pixels[targetPos + 1] = scaledImageData.data[scaledPos + 1];
            pixels[targetPos + 2] = scaledImageData.data[scaledPos + 2];
            pixels[targetPos + 3] = scaledImageData.data[scaledPos + 3];
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      Editor.originalImageData = imageData;

      let sourceImage;
      if (Editor.currentImage.dataset.galleryId) {
        sourceImage = Editor.galleryImages.find(img => img.id === Editor.currentImage.dataset.galleryId);
      } else {
        sourceImage = Editor.galleryImages.find(img => img.imageUrl === Editor.currentImage.src);
      }
      
      if (sourceImage) {
        try {
          await room.collection('gallery_images').update(sourceImage.id, {
            uses: (sourceImage.uses || 0) + 1
          });
          
          const basePromptHistory = Editor.galleryImages.find(img => 
            img.imageUrl === Editor.currentImage.src
          )?.promptHistory || [{
            prompt: sourceImage.prompt,
            timestamp: sourceImage.created_at,
            username: sourceImage.username
          }];
          
          const promptHistory = [...basePromptHistory];
          
          promptHistory.push({
            prompt: fullPrompt,
            timestamp: new Date().toISOString(),
            type: 'selection-fill',
            username: room.party.client.username
          });
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          const file = new File([blob], 'edited-image.png', { type: 'image/png' });
          const imageUrl = await websim.upload(file);
          
          const newEntry = await room.collection('gallery_images').create({
            prompt: fullPrompt,
            title: fullPrompt,
            imageUrl: imageUrl,
            views: 0,
            uses: 0,
            modified: true,
            promptHistory: promptHistory,
            sourceImageId: sourceImage.id
          });

          Editor.currentImage.src = imageUrl;
          Editor.currentImage.dataset.galleryId = newEntry.id;
          
        } catch (error) {
          console.error('Error saving selection fill:', error);
          showNotification('Failed to save selection fill. Please try again.', 'error');
        }
      }
      
      document.getElementById('fillImagePrompt').style.display = 'none';
      generatedImage.remove();
    };

    document.body.appendChild(generatedImage);
  }
};

document.getElementById('sensitivitySlider')?.addEventListener('input', (e) => {
  document.getElementById('sensitivityValue').textContent = e.target.value;
  if (Selection.magicWand) {
    Selection.magicWand.tolerance = parseInt(e.target.value);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('editCanvas');
  const container = document.getElementById('editorContainer');
  
  container.addEventListener('wheel', Selection.handleZoom.bind(Selection));
  canvas.addEventListener('mousedown', Selection.startPan.bind(Selection));
  document.addEventListener('mousemove', Selection.handlePan.bind(Selection));
  document.addEventListener('mouseup', Selection.stopPan.bind(Selection));
  
  // Add zoom buttons
  const zoomControls = document.createElement('div');
  zoomControls.className = 'zoom-controls';
  zoomControls.innerHTML = `
    <button onclick="Selection.zoom *= 1.1; Selection.updateCanvasView()">🔍+</button>
    <button onclick="Selection.zoom = 1; Selection.panX = 0; Selection.panY = 0; Selection.updateCanvasView()">Reset</button>
    <button onclick="Selection.zoom /= 1.1; Selection.updateCanvasView()">🔍-</button>
  `;
  container.appendChild(zoomControls);
});