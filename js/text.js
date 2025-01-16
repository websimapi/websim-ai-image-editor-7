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
    } else {
      textControls.style.display = 'none';
      canvas.style.cursor = 'default';
      this.cancelText();
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
    this.preview.textContent = text || 'Enter text...';
  },

  handleTool(clientX, clientY, canvasX, canvasY) {
    const textControls = document.getElementById('textControls');
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    
    if (this.preview) {
      this.preview.remove();
    }
    
    this.preview = document.createElement('div');
    this.preview.className = 'text-preview';
    this.preview.style.position = 'fixed';
    this.preview.style.left = `${clientX}px`;
    this.preview.style.top = `${clientY}px`;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    this.currentPosition = { 
      x: canvasX, 
      y: canvasY,
      scaleX,
      scaleY
    };

    document.body.appendChild(this.preview);
    
    const controlsHeight = 100;
    const controlsWidth = 250;
    
    let top = clientY + 30;
    let left = clientX;
    
    if (top + controlsHeight > window.innerHeight) {
      top = window.innerHeight - controlsHeight - 10;
    }
    
    if (left + controlsWidth > window.innerWidth) {
      left = window.innerWidth - controlsWidth - 10;
    }
    
    textControls.style.display = 'flex';
    textControls.style.left = `${left}px`;
    textControls.style.top = `${top}px`;
    
    document.getElementById('textInput').focus();
    
    this.updatePreview();

    // Add input listeners if not already added
    const textInput = document.getElementById('textInput');
    const fontFamily = document.getElementById('fontFamily');
    const fontSize = document.getElementById('fontSize');
    const textColor = document.getElementById('textColor');
    
    textInput.oninput = () => this.updatePreview();
    fontFamily.onchange = () => this.updatePreview();
    fontSize.oninput = () => this.updatePreview();
    textColor.oninput = () => this.updatePreview();
  },

  async commitText() {
    if (!this.currentPosition || !Editor.currentImage) return;
    
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const text = document.getElementById('textInput').value;
    
    if (!text.trim()) {
      this.cancelText();
      return;
    }
    
    ctx.save();
    
    const fontFamily = document.getElementById('fontFamily').value;
    const fontSize = document.getElementById('fontSize').value;
    const color = document.getElementById('textColor').value;
    
    // Scale the font size based on the canvas scaling
    const scaledFontSize = fontSize * this.currentPosition.scaleX;
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';  

    ctx.fillText(text, this.currentPosition.x, this.currentPosition.y);
    
    ctx.restore();
    
    Editor.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let sourceImage;
    if (Editor.currentImage.dataset.galleryId) {
      sourceImage = Editor.galleryImages.find(img => img.id === Editor.currentImage.dataset.galleryId);
    } else {
      sourceImage = Editor.galleryImages.find(img => img.imageUrl === Editor.currentImage.src);
    }
    
    if (sourceImage) {
      try {
        const basePromptHistory = Editor.galleryImages.find(img => 
          img.imageUrl === Editor.currentImage.src
        )?.promptHistory || [{
          prompt: sourceImage.prompt,
          timestamp: sourceImage.created_at,
          username: sourceImage.username
        }];
        
        const promptHistory = [...basePromptHistory];
        
        promptHistory.push({
          prompt: `Added text: "${text}" (${fontFamily}, ${fontSize}px, ${color})`,
          timestamp: new Date().toISOString(),
          type: 'text-edit',
          username: room.party.client.username
        });
        
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

        await room.collection('gallery_images').update(sourceImage.id, {
          uses: (sourceImage.uses || 0) + 1
        });

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
    document.getElementById('textInput').value = '';
    
    if (this.preview) {
      this.preview.remove();
      this.preview = null;
    }
    
    this.currentPosition = null;
  }
};