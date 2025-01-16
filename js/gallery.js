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
    const galleryEl = document.getElementById('gallery');
    let images = [...this.images];
    
    if (this.currentUserFilter) {
      images = images.filter(img => {
        const isCreator = img.username === this.currentUserFilter;
        const hasModifications = img.promptHistory?.some(entry => 
          entry.username === this.currentUserFilter
        );
        return isCreator || hasModifications;
      });
    } else if (this.currentSearch) {
      const searchLower = this.currentSearch.toLowerCase();
      images = images.filter(img => 
        img.prompt.toLowerCase().includes(searchLower) || 
        img.username.toLowerCase().includes(searchLower)
      );
    }

    if (this.currentUserFilter) {
      document.getElementById('userFilterInfo').style.display = 'flex';
      document.getElementById('userFilterName').textContent = this.currentUserFilter;
    } else {
      document.getElementById('userFilterInfo').style.display = 'none';
    }

    switch (this.currentTab) {
      case 'popular':
        images.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'my':
        images = images.filter(img => {
          const isOriginalCreator = img.username === room.party.client.username;
          const hasModifications = img.promptHistory?.some(entry => 
            entry.username === room.party.client.username && 
            entry.timestamp !== img.created_at
          );
          return isOriginalCreator || hasModifications;
        });
        break;
      default:
        images.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const paginatedImages = images.slice(start, end);

    if (paginatedImages.length === 0) {
      galleryEl.innerHTML = `
        <div class="no-results">
          ${this.currentUserFilter ? 'No images found by this user' : this.currentSearch ? 'No images found matching your search' : 'No images available'}
        </div>
      `;
      document.getElementById('prevPage').disabled = true;
      document.getElementById('nextPage').disabled = true;
      document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${Math.ceil(images.length / this.itemsPerPage)}`;
      return;
    }

    galleryEl.innerHTML = paginatedImages.map(img => `
      <div class="gallery-item">
        <div 
          class="gallery-item-image" 
          style="background-image: url('${img.imageUrl}')"
          onclick="Gallery.loadImage('${img.id}')"
          role="img" 
          aria-label="${img.prompt}"
        ></div>
        <div class="metadata">
          <div class="image-title" ${img.username === room.party.client.username ? 'onclick="Gallery.editTitle(\'' + img.id + '\')"' : ''}>
            ${img.title || img.prompt}
            ${img.username === room.party.client.username ? '<span class="edit-icon">✎</span>' : ''}
          </div>
          <div>${img.modified ? '(Remix)' : ''}</div>
          <div class="prompt-history">
            ${this.renderPromptHistory(img)}
          </div>
          <div>by <span class="username-link" onclick="Gallery.showUserGallery('${img.username}')">${img.username}</span></div>
          <div>${new Date(img.created_at).toLocaleDateString()}</div>
        </div>
        <div class="stats">
          <span>${img.views || 0} views</span>
          <span>${img.uses || 0} uses</span>
        </div>
        ${img.username === room.party.client.username ? `
          <div class="gallery-item-controls">
            <button class="edit-button" onclick="Gallery.editTitle('${img.id}')" title="Edit Title">
              <svg viewBox="0 0 24 24">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
              </svg>
            </button>
            <button class="delete-button" onclick="Gallery.deleteImage('${img.id}')" title="Delete Image">
              <svg viewBox="0 0 24 24">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
    
    document.getElementById('prevPage').disabled = this.currentPage === 1;
    document.getElementById('nextPage').disabled = this.currentPage === Math.ceil(images.length / this.itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${Math.ceil(images.length / this.itemsPerPage)}`;
  },

  renderPromptHistory(image) {
    if (!image.promptHistory || !image.promptHistory.length) {
      return `
        <div class="prompt-history">
          <div class="prompt-history-header" onclick="Gallery.togglePromptHistory(this)">
            <span>Prompt History (1)</span>
            <svg class="expand-icon" width="12" height="12" viewBox="0 0 12 12">
              <path fill="currentColor" d="M2 4h8L6 8 2 4z"/>
            </svg>
          </div>
          <div class="prompt-history-entries" style="display: none;">
            <div class="prompt-history-entry">
              <div>Original prompt: ${image.prompt}</div>
              <div class="by-user">by <span class="username-link" onclick="Gallery.showUserGallery('${image.username}')">${image.username}</span></div>
              <div class="timestamp">${new Date(image.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="prompt-history">
        <div class="prompt-history-header" onclick="Gallery.togglePromptHistory(this)">
          <span>Prompt History (${image.promptHistory.length})</span>
          <svg class="expand-icon" width="12" height="12" viewBox="0 0 12 12">
            <path fill="currentColor" d="M2 4h8L6 8 2 4z"/>
          </svg>
        </div>
        <div class="prompt-history-entries" style="display: none;">
          ${image.promptHistory.map((entry, index) => `
            <div class="prompt-history-entry">
              <div>
                ${index === 0 ? 'Original prompt: ' : 
                  entry.type === 'selection-fill' ? 'Selection fill: ' : 
                  entry.type === 'text-edit' ? 'Text edit: ' : 
                  'Modified with: '}
                ${entry.prompt}
              </div>
              <div class="by-user">by <span class="username-link" onclick="Gallery.showUserGallery('${entry.username || image.username}')">${entry.username || image.username}</span></div>
              <div class="timestamp">${new Date(entry.timestamp).toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  togglePromptHistory(header) {
    const historyDiv = header.closest('.prompt-history');
    historyDiv.classList.toggle('expanded');
    const entriesDiv = historyDiv.querySelector('.prompt-history-entries');
    entriesDiv.style.display = historyDiv.classList.contains('expanded') ? 'block' : 'none';
  },

  async loadImage(id) {
    const image = this.images.find(img => img.id === id);
    if (!image) return;
    
    await room.collection('gallery_images').update(id, {
      views: (image.views || 0) + 1,
      uses: (image.uses || 0) + 1
    });
    
    Editor.loadGalleryImage(image);
  },

  showTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.gallery-tab').forEach(el => {
      el.classList.toggle('active', el.textContent.toLowerCase().includes(tab));
    });
    this.render();
  },

  changePage(delta) {
    this.currentPage += delta;
    this.render();
  },

  showUserGallery(username) {
    this.currentUserFilter = username;
    this.currentPage = 1;  // Reset to first page
    this.render();
  },

  clearUserFilter() {
    this.currentUserFilter = null;
    this.render();
  },

  filterGallery() {
    const searchInput = document.getElementById('gallerySearch');
    this.currentSearch = searchInput.value.trim();
    this.render();
  },

  async deleteImage(id) {
    if (!confirm('Are you sure you want to delete this image?')) return;
    await room.collection('gallery_images').delete(id);
    this.render();
  },

  editTitle(id) {
    const image = this.images.find(img => img.id === id);
    if (!image) return;
    
    this.currentEditId = id;
    const dialog = document.getElementById('editTitleDialog');
    const input = document.getElementById('editTitleInput');
    input.value = image.title || image.prompt;
    dialog.style.display = 'block';
  },

  async saveTitleEdit() {
    if (!this.currentEditId) return;
    
    const input = document.getElementById('editTitleInput');
    const newTitle = input.value.trim();
    
    if (!newTitle) {
      alert('Please enter a title');
      return;
    }
    
    await room.collection('gallery_images').update(this.currentEditId, {
      title: newTitle
    });
    
    this.cancelTitleEdit();
  },

  cancelTitleEdit() {
    this.currentEditId = null;
    const dialog = document.getElementById('editTitleDialog');
    const input = document.getElementById('editTitleInput');
    input.value = '';
    dialog.style.display = 'none';
  }
};