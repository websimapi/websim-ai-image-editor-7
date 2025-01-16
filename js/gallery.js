import { room } from './room.js';
import { Editor } from './editor.js';

export const Gallery = {
  images: [],
  currentTab: 'recent',
  currentPage: 1,
  itemsPerPage: 10, 
  currentEditId: null,
  currentSearch: '',
  currentUserFilter: null,

  async init() {
    this.images = await room.collection('gallery_images').getList();
    room.collection('gallery_images').subscribe(images => {
      this.images = images;
      this.render();
    });
    this.render();
  },

  render() {
    // Gallery rendering logic
  },

  showTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.gallery-tab').forEach(el => {
      el.classList.toggle('active', el.textContent.toLowerCase().includes(tab));
    });
    this.render();
  }
};