import { room } from './room.js';
import { Selection } from './selection.js';
import { Gallery } from './gallery.js';

export const Editor = {
  currentImage: null,
  originalImageData: null,
  galleryImages: [],

  setup() {
    this.setupEventListeners();
    this.setupColorPicker();
  },

  async setupEventListeners() {
    document.getElementById('promptInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.generateImage();
      }
    });
    this.galleryImages = await room.collection('gallery_images').getList();
    room.collection('gallery_images').subscribe(images => {
      this.galleryImages = images;
    });
  },

  setupColorPicker() {
    const picker = document.getElementById('colorPicker');
    const preview = document.getElementById('colorPreview'); 
    const value = document.getElementById('colorValue');

    picker.addEventListener('input', e => {
      preview.style.backgroundColor = e.target.value;
      value.textContent = e.target.value.toUpperCase();
    });

    preview.style.backgroundColor = picker.value;
    value.textContent = picker.value.toUpperCase();
  },

  async generateImage() {
    const prefixSelect = document.getElementById('prefixPrompt');
    const promptInput = document.getElementById('promptInput');
    const suffixSelect = document.getElementById('suffixPrompt');
    const fullPrompt = `${prefixSelect.value}${promptInput.value.trim()}${suffixSelect.value}`;

    const imageContainer = document.getElementById('imageContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const placeholderText = document.getElementById('placeholderText');
    const saveButton = document.getElementById('saveButton');
    const addGalleryButton = document.getElementById('addGalleryButton');

    if (!promptInput.value.trim()) {
      alert('Please enter a prompt!');
      return;
    }

    loadingSpinner.style.display = 'block';
    placeholderText.style.display = 'none';
    saveButton.style.display = 'none';
    addGalleryButton.style.display = 'none';

    const existingImages = imageContainer.querySelectorAll('img');
    existingImages.forEach(img => img.remove());

    const generatedImage = document.createElement('img');
    generatedImage.id = `generatedImage_${Date.now()}`;
    generatedImage.className = 'generated-image';
    generatedImage.style.display = 'none';
    generatedImage.crossOrigin = 'anonymous';
    generatedImage.dataset.freshGeneration = 'true';
    
    generatedImage.src = fullPrompt;
    generatedImage.alt = fullPrompt;

    generatedImage.onload = async () => {
      if (generatedImage.dataset.freshGeneration === 'true') {
        generatedImage.dataset.freshGeneration = 'false';
        
        loadingSpinner.style.display = 'none';
        generatedImage.style.display = 'block';
        placeholderText.style.display = 'none';
        saveButton.style.display = 'block';
        addGalleryButton.style.display = 'block';
        this.currentImage = generatedImage;
        
        try {
          const galleryEntry = await room.collection('gallery_images').create({
            prompt: fullPrompt,
            imageUrl: generatedImage.src,
            views: 0,
            uses: 0,
            promptHistory: [{
              prompt: fullPrompt,
              timestamp: new Date().toISOString(),
              username: room.party.client.username
            }]
          });
          
          generatedImage.dataset.galleryId = galleryEntry.id;
          this.setupImageEditor();
          
        } catch (error) {
          console.error('Error processing generated image:', error);
          alert('Failed to process generated image. Please try again.');
        }
      }
    };

    imageContainer.appendChild(generatedImage);
  },

  setupImageEditor() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const editorControls = document.getElementById('editorControls');
    const fillImagePrompt = document.getElementById('fillImagePrompt');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const placeholderText = document.getElementById('placeholderText');

    loadingSpinner.style.display = 'none';
    placeholderText.style.display = 'none';

    if (this.currentImage) {
      canvas.width = this.currentImage.naturalWidth;
      canvas.height = this.currentImage.naturalHeight;
      ctx.drawImage(this.currentImage, 0, 0);
      this.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.currentImage.style.display = 'none';
      canvas.style.display = 'block';
      editorControls.style.display = 'flex';
    } else {
      canvas.style.display = 'none';
      editorControls.style.display = 'flex';
    }

    fillImagePrompt.style.display = 'none';

    if (!canvas.hasEventListener) {
      canvas.addEventListener('click', Selection.handleCanvasClick);
      canvas.hasEventListener = true;
    }
  },

  async generateSelectionFill() {
    if (!Selection.current || !this.currentImage) return;
    
    const prompt = document.getElementById('selectionPromptInput').value.trim();
    if (!prompt) {
      alert('Please enter a prompt for the selected region');
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
      // Rest of the fill logic remains the same
      // ...
    };

    document.body.appendChild(generatedImage);
  },

  resetImage() {
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(this.originalImageData, 0, 0);
    Selection.clear();
  },

  saveImage() {
    const canvas = document.getElementById('editCanvas');
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  },

  async addToGallery() {
    const canvas = document.getElementById('editCanvas');
    const promptInput = document.getElementById('promptInput');
    const prefixSelect = document.getElementById('prefixPrompt');
    const suffixSelect = document.getElementById('suffixPrompt');
    const fullPrompt = `${prefixSelect.value}${promptInput.value.trim()}${suffixSelect.value}`;
    
    try {
      const sourceImage = this.galleryImages.find(img => 
        img.imageUrl === this.currentImage.src
      );
      
      if (sourceImage) {
        await room.collection('gallery_images').update(sourceImage.id, {
          uses: (sourceImage.uses || 0) + 1,
          views: (sourceImage.views || 0) + 1
        });
      }
      
      // Rest of gallery addition logic remains the same
      // ...
      
    } catch (error) {
      console.error('Error adding to gallery:', error);
      alert('Failed to add image to gallery. Please try again.');
    }
  },

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.currentImage = img;
          this.setupImageEditor();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
};