import { Editor } from './editor.js';

export const Selection = {
  current: null,
  isShiftPressed: false,
  isCtrlPressed: false,

  setTool(tool) {
    const canvas = document.getElementById('editCanvas');
    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const textControls = document.getElementById('textControls');
    
    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
    
    const toolButton = document.getElementById(`${tool}Tool`);
    if (toolButton) {
      toolButton.classList.add('active');
    }

    if (tool === 'fillSelection' && this.current) {
      fillImagePrompt.style.display = 'none';
      this.fillSelection();
    } else if (tool === 'setAlpha' && this.current) {
      fillImagePrompt.style.display = 'none';
      this.setAlpha();
    } else if (tool === 'fillWithImage' && this.current) {
      fillImagePrompt.style.display = 'flex';
    } else if (tool === 'text') {
      canvas.style.cursor = 'text';
    } else {
      fillImagePrompt.style.display = 'none';
      textControls.style.display = 'none';
      canvas.style.cursor = tool === 'magicWand' ? 'crosshair' : 'default';
    }
  },

  handleCanvasClick(e) {
    const canvas = document.getElementById('editCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const activeTool = document.querySelector('.tool-button.active');
    if (activeTool && activeTool.id === 'textTool') {
      // Note: The Text object is not defined in the plan, 
      // assuming it's defined elsewhere in the codebase.
      Text.handleTool(e.clientX, e.clientY, x, y);
      return;
    }

    if (!Selection.isShiftPressed && !Selection.isCtrlPressed) {
      Selection.current = null;
    }

    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const newSelection = Selection.magicWandSelect(imageData, Math.round(x), Math.round(y), 32);
    
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
    // ... existing magic wand selection logic ...
  },

  drawOverlay() {
    // ... existing selection overlay drawing logic ...
  },

  fillSelection() {
    // ... existing fill selection logic ...
  },

  setAlpha() {
    // ... existing alpha setting logic ...
  },

  clear() {
    this.current = null;
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(Editor.originalImageData, 0, 0);
  }
};