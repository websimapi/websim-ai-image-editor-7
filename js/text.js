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
    }
  },

  updatePreview() {
    if (!Text.preview || !Text.currentPosition) return;
    
    const text = document.getElementById('textInput').value;
    const fontFamily = document.getElementById('fontFamily').value;
    const fontSize = document.getElementById('fontSize').value;
    const color = document.getElementById('textColor').value;
    
    Text.preview.style.fontFamily = fontFamily;
    Text.preview.style.fontSize = `${fontSize}px`;
    Text.preview.style.color = color;
    Text.preview.style.pointerEvents = 'none';
    Text.preview.textContent = text || 'Enter text...';
  },

  handleTool(clientX, clientY, canvasX, canvasY) {
    const textControls = document.getElementById('textControls');
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    
    if (Text.preview) {
      Text.preview.remove();
    }
    
    Text.preview = document.createElement('div');
    Text.preview.className = 'text-preview';
    Text.preview.style.position = 'fixed';
    Text.preview.style.left = `${clientX}px`;
    Text.preview.style.top = `${clientY}px`;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    Text.currentPosition = { 
      x: canvasX, 
      y: canvasY,
      scaleX,
      scaleY
    };

    document.body.appendChild(Text.preview);
    
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
    
    Text.updatePreview();
  },

  async commitText() {
    // TO DO: implement commit text logic
  },

  cancelText() {
    const textControls = document.getElementById('textControls');
    textControls.style.display = 'none';
    document.getElementById('textInput').value = '';
    
    if (Text.preview) {
      Text.preview.remove();
      Text.preview = null;
    }
    
    Text.currentPosition = null;
  }
};