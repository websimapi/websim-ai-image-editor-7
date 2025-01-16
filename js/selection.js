import { Editor } from './editor.js';
import { room } from './room.js';
import { showNotification } from './notifications.js';

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,
  isDragging: false,
  startX: null,
  startY: null,
  dragSelection: null,

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

    // Set up drag selection events when magicWand is active
    if (tool === 'magicWand') {
      canvas.addEventListener('mousedown', this.startDragSelection.bind(this));
      canvas.addEventListener('mousemove', this.updateDragSelection.bind(this));
      canvas.addEventListener('mouseup', this.endDragSelection.bind(this));
    } else {
      canvas.removeEventListener('mousedown', this.startDragSelection.bind(this));
      canvas.removeEventListener('mousemove', this.updateDragSelection.bind(this));
      canvas.removeEventListener('mouseup', this.endDragSelection.bind(this));
    }
  },

  startDragSelection(e) {
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    this.isDragging = true;
    this.startX = (e.clientX - rect.left) * (canvas.width / rect.width);
    this.startY = (e.clientY - rect.top) * (canvas.height / rect.height);
    this.dragSelection = null;
  },

  updateDragSelection(e) {
    if (!this.isDragging) return;
    
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const currentY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Create selection based on drag area
    const width = canvas.width;
    const height = canvas.height;
    this.dragSelection = new Uint8Array(width * height);
    
    const minX = Math.max(0, Math.min(this.startX, currentX));
    const maxX = Math.min(width, Math.max(this.startX, currentX));
    const minY = Math.max(0, Math.min(this.startY, currentY));
    const maxY = Math.min(height, Math.max(this.startY, currentY));
    
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x < Math.ceil(maxX); x++) {
        this.dragSelection[y * width + x] = 1;
      }
    }
    
    this.drawDragOverlay();
  },

  endDragSelection(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    if (!this.dragSelection) {
      this.handleCanvasClick(e);
      return;
    }
    
    if (!this.isShiftPressed && !this.isCtrlPressed) {
      this.current = null;
    }
    
    if (this.current === null) {
      this.current = this.dragSelection;
    } else {
      const newSelection = new Uint8Array(this.current.length);
      for (let i = 0; i < this.current.length; i++) {
        if (this.isCtrlPressed) {
          // Anti-selection with CTRL
          newSelection[i] = this.current[i] && !this.dragSelection[i];
        } else {
          // Add to selection
          newSelection[i] = this.current[i] || this.dragSelection[i];
        }
      }
      this.current = newSelection;
    }
    
    this.dragSelection = null;
    this.drawOverlay();
  },

  drawDragOverlay() {
    if (!this.dragSelection) return;
    
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(Editor.originalImageData, 0, 0);
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw current selection if it exists
    if (this.current) {
      this.drawSelectionOutline(this.current, 'rgba(255, 255, 255, 0.3)');
    }
    
    // Draw drag selection
    this.drawSelectionOutline(this.dragSelection, this.isCtrlPressed ? 
      'rgba(255, 0, 0, 0.3)' : // Red for anti-selection
      'rgba(0, 255, 0, 0.3)'   // Green for normal selection
    );
  },

  drawSelectionOutline(selection, color) {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    
    // Create a temporary canvas for the selection overlay
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw selection with semi-transparent color
    const imgData = tempCtx.createImageData(width, height);
    for (let i = 0; i < selection.length; i++) {
      if (selection[i]) {
        const pos = i * 4;
        const [r, g, b, a] = color.match(/\d+/g).map(Number);
        imgData.data[pos] = r;
        imgData.data[pos + 1] = g;
        imgData.data[pos + 2] = b;
        imgData.data[pos + 3] = Math.floor(a * 255);
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    
    // Draw the selection overlay
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Draw outline
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        if (selection[pos]) {
          const isEdge = x > 0 && !selection[pos - 1] || 
                        x < width - 1 && !selection[pos + 1] || 
                        y > 0 && !selection[pos - width] || 
                        y < height - 1 && !selection[pos + width];
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

  handleCanvasClick(e) {
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const sensitivity = parseInt(document.getElementById('sensitivitySlider').value);

    if (!this.isShiftPressed && !this.isCtrlPressed) {
      this.current = null;
    }

    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const newSelection = this.magicWandSelect(imageData, Math.round(x), Math.round(y), sensitivity);
    
    if (this.isCtrlPressed) {
      // Anti-selection with CTRL
      if (this.current) {
        for (let i = 0; i < this.current.length; i++) {
          this.current[i] = this.current[i] && !newSelection[i];
        }
      } else {
        this.current = newSelection;
      }
    } else if (this.isShiftPressed) {
      // Add to selection with Shift
      if (this.current) {
        for (let i = 0; i < this.current.length; i++) {
          this.current[i] = this.current[i] || newSelection[i];
        }
      } else {
        this.current = newSelection;
      }
    } else {
      this.current = newSelection;
    }

    this.drawOverlay();
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

  clearSelection() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    if (Editor.originalImageData) {
      ctx.putImageData(Editor.originalImageData, 0, 0);
    }
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