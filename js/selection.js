import { Editor } from './editor.js';
import { room } from './room.js';
import { showNotification } from './notifications.js';

class MagicWand {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.tolerance = 32;
    this.visited = new Set();
    this.selection = new Set();
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const imageData = this.ctx.getImageData(x, y, 1, 1).data;
    return {
      r: imageData[0],
      g: imageData[1],
      b: imageData[2],
      a: imageData[3]
    };
  }

  colorDifference(color1, color2) {
    const labColor1 = this.rgbToLab(color1);
    const labColor2 = this.rgbToLab(color2);
    
    return Math.sqrt(
      Math.pow(labColor2.l - labColor1.l, 2) +
      Math.pow(labColor2.a - labColor1.a, 2) +
      Math.pow(labColor2.b - labColor1.b, 2)
    );
  }

  rgbToLab(rgb) {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
    const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

    const xn = 95.047;
    const yn = 100.000;
    const zn = 108.883;

    const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn) + 16/116;
    const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn) + 16/116;
    const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn) + 16/116;

    return {
      l: (116 * fy) - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  detectEdges(x, y) {
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    let gradientX = 0;
    let gradientY = 0;

    for(let i = -1; i <= 1; i++) {
      for(let j = -1; j <= 1; j++) {
        const pixel = this.getPixel(x + i, y + j);
        const intensity = (pixel.r + pixel.g + pixel.b) / 3;
        gradientX += intensity * sobelX[i + 1][j + 1];
        gradientY += intensity * sobelY[i + 1][j + 1];
      }
    }

    return Math.sqrt(gradientX * gradientX + gradientY * gradientY);
  }

  select(startX, startY) {
    this.visited.clear();
    this.selection.clear();
    
    const startColor = this.getPixel(startX, startY);
    const queue = [{x: startX, y: startY}];
    
    while(queue.length > 0) {
      const current = queue.shift();
      const key = `${current.x},${current.y}`;
      
      if(this.visited.has(key)) continue;
      this.visited.add(key);
      
      const currentColor = this.getPixel(current.x, current.y);
      const colorDiff = this.colorDifference(startColor, currentColor);
      const edgeStrength = this.detectEdges(current.x, current.y);
      
      if(colorDiff <= this.tolerance && edgeStrength < 100) {
        this.selection.add(key);
        
        const neighbors = [
          {x: current.x - 1, y: current.y},
          {x: current.x + 1, y: current.y},
          {x: current.x, y: current.y - 1},
          {x: current.x, y: current.y + 1}
        ];
        
        for(const neighbor of neighbors) {
          if(neighbor.x >= 0 && neighbor.x < this.canvas.width &&
             neighbor.y >= 0 && neighbor.y < this.canvas.height) {
            queue.push(neighbor);
          }
        }
      }
    }
    
    return new Uint8Array(this.canvas.width * this.canvas.height).map((_, i) => {
      const x = i % this.canvas.width;
      const y = Math.floor(i / this.canvas.width);
      return this.selection.has(`${x},${y}`) ? 1 : 0;
    });
  }
}

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,
  magicWand: null,

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
  },

  handleCanvasClick(e) {
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));

    if (!Selection.magicWand) {
      Selection.magicWand = new MagicWand(canvas);
    }

    Selection.magicWand.tolerance = parseInt(document.getElementById('sensitivitySlider').value);

    if (!Selection.isShiftPressed && !Selection.isCtrlPressed) {
      Selection.current = null;
    }

    const newSelection = Selection.magicWand.select(x, y);
    
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

  drawOverlay() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(Editor.originalImageData, 0, 0);
    
    if (!this.current) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw selection edges
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

// Set up sensitivity slider handler
document.getElementById('sensitivitySlider')?.addEventListener('input', (e) => {
  document.getElementById('sensitivityValue').textContent = e.target.value;
  if (Selection.magicWand) {
    Selection.magicWand.tolerance = parseInt(e.target.value);
  }
});