import { Editor } from './editor.js';
import { room } from './room.js';
import { showNotification } from './notifications.js';

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,
  isDragging: false,
  lastX: null,
  lastY: null,

  init() {
    const canvas = document.getElementById('editCanvas');
    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
  },

  setTool(tool) {
    const canvas = document.getElementById('editCanvas');
    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const sensitivityControl = document.getElementById('sensitivityControl');
    
    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
    
    const toolButton = document.getElementById(`${tool}Tool`);
    if (toolButton) {
      toolButton.classList.add('active');
    }

    sensitivityControl.style.display = tool === 'magicWand' ? 'flex' : 'none';

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

  handleMouseDown(e) {
    this.isDragging = true;
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    this.lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
    this.lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
    this.handleCanvasClick(e);
  },

  handleMouseMove(e) {
    if (!this.isDragging) return;
    
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Only process if mouse has moved enough to avoid performance issues
    const distance = Math.sqrt(Math.pow(x - this.lastX, 2) + Math.pow(y - this.lastY, 2));
    if (distance > 5) {
      this.lastX = x;
      this.lastY = y;
      this.handleCanvasClick(e);
    }
  },

  handleMouseUp() {
    this.isDragging = false;
  },

  handleCanvasClick(e) {
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const sensitivity = parseInt(document.getElementById('sensitivitySlider').value);

    if (!this.isShiftPressed && !this.isCtrlPressed && !this.isDragging) {
      this.current = null;
    }

    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const newSelection = this.magicWandSelect(imageData, Math.round(x), Math.round(y), sensitivity);
    
    if (this.isCtrlPressed) {
      // CTRL+click to deselect
      if (this.current) {
        for (let i = 0; i < this.current.length; i++) {
          if (newSelection[i]) {
            this.current[i] = 0;
          }
        }
      }
    } else if (this.isShiftPressed || this.isDragging) {
      // Shift+click or dragging to add to selection
      if (this.current) {
        for (let i = 0; i < this.current.length; i++) {
          this.current[i] = this.current[i] || newSelection[i];
        }
      } else {
        this.current = newSelection;
      }
    } else {
      // Normal click creates new selection
      this.current = newSelection;
    }

    this.drawSelection();
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

  drawSelection() {
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

  fillSelection() {
    if (!this.current) return;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const color = document.getElementById('colorPicker').value;
    const r = parseInt(color.substr(1, 2), 16);
    const g = parseInt(color.substr(3, 2), 16);
    const b = parseInt(color.substr(5, 2), 16);
    
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i]) {
        const pixelPos = i * 4;
        pixels[pixelPos] = r;
        pixels[pixelPos + 1] = g;
        pixels[pixelPos + 2] = b;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    Editor.originalImageData = imageData;
  },

  setAlpha() {
    if (!this.current) return;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i]) {
        const pixelPos = i * 4;
        pixels[pixelPos + 3] = 0;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    Editor.originalImageData = imageData;
  },

  clear() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    if (Editor.originalImageData) {
      ctx.putImageData(Editor.originalImageData, 0, 0);
    }
  },

  clearSelection() {
    this.clear();
  },

  fillWithImage(prompt) {
    if (!this.current || !Editor.currentImage) {
      showNotification('Please make a selection first', 'error');
      return;
    }
    
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

      // Handle gallery updates
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

// Add event listener for sensitivity slider
document.getElementById('sensitivitySlider')?.addEventListener('input', (e) => {
  document.getElementById('sensitivityValue').textContent = e.target.value;
});