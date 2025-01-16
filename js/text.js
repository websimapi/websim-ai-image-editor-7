import { Editor } from './editor.js';
import { room } from './room.js';

export const Text = {
  currentPosition: null,
  preview: null,

  setTool(tool) {
    const canvas = document.getElementById('editCanvas');
    const textControls = document.getElementById('textControls');
    if (tool === 'text') {
      canvas.style.cursor = 'text';
      textControls.style.display = 'none';
    } else {
      textControls.style.display = 'none';
      canvas.style.cursor = 'default';
    }
  },

  updatePreview() {
    if (!this.preview || !this.currentPosition) return;
    
    const text = document.getElementById('textInput').value;
    const fontFamily = document.getElementById('fontFamily').value;
    const fontSize = document.getElementById('fontSize').value;
    const color = document.getElementById('textColor').value;
    
    this.preview.style.fontFamily = fontFamily;
    this.preview.style.fontSize = `${fontSize}px`;
    this.preview.style.color = color;
    this.preview.style.pointerEvents = 'none';
    this.preview.textContent = text || 'Enter text...';
  },

  handleTool(clientX, clientY, canvasX, canvasY) {
    if (this.preview) {
      this.preview.remove();
    }

    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Create preview element
    this.preview = document.createElement('div');
    this.preview.className = 'text-preview';
    this.preview.style.position = 'fixed';
    this.preview.style.left = `${clientX}px`;
    this.preview.style.top = `${clientY}px`;
    document.body.appendChild(this.preview);

    // Store position with scale factors
    this.currentPosition = { 
      x: canvasX,
      y: canvasY,
      scaleX,
      scaleY
    };

    // Position text controls
    const textControls = document.getElementById('textControls');
    const controlsHeight = textControls.offsetHeight;
    const controlsWidth = textControls.offsetWidth;
    
    let top = clientY + 30;
    let left = clientX;
    
    // Adjust position if too close to viewport edges
    if (top + controlsHeight > window.innerHeight) {
      top = window.innerHeight - controlsHeight - 10;
    }
    
    if (left + controlsWidth > window.innerWidth) {
      left = window.innerWidth - controlsWidth - 10;
    }
    
    textControls.style.display = 'flex';
    textControls.style.left = `${left}px`;
    textControls.style.top = `${top}px`;

    const textInput = document.getElementById('textInput');
    textInput.value = '';
    textInput.focus();
    
    this.updatePreview();
  },

  async commitText() {
    if (!this.currentPosition || !Editor.currentImage) return;

    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const text = document.getElementById('textInput').value.trim();
    
    if (!text) {
      this.cancelText();
      return;
    }

    // Get text settings
    const fontFamily = document.getElementById('fontFamily').value;
    const fontSize = document.getElementById('fontSize').value;
    const color = document.getElementById('textColor').value;
    
    // Scale font size based on canvas scaling
    const scaledFontSize = fontSize * this.currentPosition.scaleX;

    // Draw text on canvas
    ctx.save();
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(text, this.currentPosition.x, this.currentPosition.y);
    ctx.restore();

    // Update image data
    Editor.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Save to gallery if applicable
    let sourceImage = null;
    if (Editor.currentImage.dataset.galleryId) {
      sourceImage = Editor.galleryImages.find(img => img.id === Editor.currentImage.dataset.galleryId);
    } else {
      sourceImage = Editor.galleryImages.find(img => img.imageUrl === Editor.currentImage.src);
    }

    if (sourceImage) {
      try {
        // Get base prompt history
        const basePromptHistory = Editor.galleryImages.find(img => 
          img.imageUrl === Editor.currentImage.src
        )?.promptHistory || [{
          prompt: sourceImage.prompt,
          timestamp: sourceImage.created_at,
          username: sourceImage.username
        }];

        // Add text edit to history
        const promptHistory = [...basePromptHistory];
        promptHistory.push({
          prompt: `Added text: "${text}" (${fontFamily}, ${fontSize}px, ${color})`,
          timestamp: new Date().toISOString(),
          type: 'text-edit',
          username: room.party.client.username
        });

        // Create new gallery entry
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], 'edited-image.png', { type: 'image/png' });
        const imageUrl = await websim.upload(file);

        const newEntry = await room.collection('gallery_images').create({
          prompt: sourceImage.prompt,
          title: sourceImage.title || sourceImage.prompt,
          imageUrl: imageUrl,
          views: 0,
          uses: 0,
          modified: true,
          promptHistory: promptHistory,
          sourceImageId: sourceImage.id
        });

        // Update source image usage
        await room.collection('gallery_images').update(sourceImage.id, {
          uses: (sourceImage.uses || 0) + 1
        });

        // Update current image reference
        Editor.currentImage.src = imageUrl;
        Editor.currentImage.dataset.galleryId = newEntry.id;

      } catch (error) {
        console.error('Error saving text edit:', error);
        alert('Failed to save text edit. Please try again.');
      }
    }

    this.cancelText();
  },

  cancelText() {
    const textControls = document.getElementById('textControls');
    textControls.style.display = 'none';
    
    if (this.preview) {
      this.preview.remove();
      this.preview = null;
    }
    
    this.currentPosition = null;
    document.getElementById('textInput').value = '';
  }
};

// Set up text preview update listeners
document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const fontFamily = document.getElementById('fontFamily');
  const fontSize = document.getElementById('fontSize');
  const textColor = document.getElementById('textColor');

  textInput.addEventListener('input', () => Text.updatePreview());
  fontFamily.addEventListener('change', () => Text.updatePreview());
  fontSize.addEventListener('input', () => Text.updatePreview());
  textColor.addEventListener('input', () => Text.updatePreview());
});