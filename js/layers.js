export const LayerManager = {
  layers: [],
  activeLayerId: null,

  createLayer(type, data) {
    const layer = {
      id: Date.now().toString(),
      type, // 'base', 'fill', 'selection', 'color'
      data,
      visible: true,
      opacity: 1,
      name: `${type} ${this.layers.length + 1}`,
      createdAt: new Date().toISOString(),
      editHistory: []
    };
    
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    this.renderLayerUI();
    return layer.id;
  },

  updateLayer(layerId, updates) {
    const layer = this.getLayer(layerId);
    if (!layer) return;
    
    // Store edit history
    layer.editHistory.push({
      timestamp: new Date().toISOString(),
      previousState: { ...layer },
      type: 'update'
    });

    Object.assign(layer, updates);
    this.renderLayerUI();
    Editor.renderLayers();
  },

  deleteLayer(layerId) {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index === -1) return;
    
    this.layers.splice(index, 1);
    if (this.activeLayerId === layerId) {
      this.activeLayerId = this.layers[this.layers.length - 1]?.id || null;
    }
    
    this.renderLayerUI();
    Editor.renderLayers();
  },

  getLayer(layerId) {
    return this.layers.find(l => l.id === layerId);
  },

  setActiveLayer(layerId) {
    this.activeLayerId = layerId;
    this.renderLayerUI();
  },

  moveLayer(layerId, direction) {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.layers.length) return;
    
    const layer = this.layers[index];
    this.layers.splice(index, 1);
    this.layers.splice(newIndex, 0, layer);
    
    this.renderLayerUI();
    Editor.renderLayers();
  },

  toggleLayerVisibility(layerId) {
    const layer = this.getLayer(layerId);
    if (!layer) return;
    
    layer.visible = !layer.visible;
    this.renderLayerUI();
    Editor.renderLayers();
  },

  setLayerOpacity(layerId, opacity) {
    const layer = this.getLayer(layerId);
    if (!layer) return;
    
    layer.opacity = Math.max(0, Math.min(1, opacity));
    this.renderLayerUI();
    Editor.renderLayers();
  },

  renderLayerUI() {
    const layersPanel = document.getElementById('layersPanel');
    if (!layersPanel) return;

    layersPanel.innerHTML = `
      <div class="layers-header">
        <h3>Layers</h3>
        <div class="layer-controls">
          <button onclick="Editor.flattenLayers()" class="small-button">Flatten</button>
        </div>
      </div>
      <div class="layers-list">
        ${this.layers.map(layer => `
          <div class="layer-item ${layer.id === this.activeLayerId ? 'active' : ''}" 
               onclick="LayerManager.setActiveLayer('${layer.id}')">
            <div class="layer-visibility">
              <input type="checkbox" 
                     ${layer.visible ? 'checked' : ''} 
                     onchange="LayerManager.toggleLayerVisibility('${layer.id}')"
              >
            </div>
            <div class="layer-preview ${layer.type}-preview"></div>
            <div class="layer-info">
              <input type="text" 
                     value="${layer.name}" 
                     onchange="LayerManager.updateLayer('${layer.id}', {name: this.value})"
              >
              <div class="layer-type">${layer.type}</div>
            </div>
            <div class="layer-opacity">
              <input type="range" 
                     min="0" 
                     max="100" 
                     value="${layer.opacity * 100}"
                     onchange="LayerManager.setLayerOpacity('${layer.id}', this.value / 100)"
              >
            </div>
            <div class="layer-controls">
              <button onclick="LayerManager.moveLayer('${layer.id}', 'up')" 
                      class="small-button" 
                      ${this.layers.indexOf(layer) === 0 ? 'disabled' : ''}>↑</button>
              <button onclick="LayerManager.moveLayer('${layer.id}', 'down')" 
                      class="small-button"
                      ${this.layers.indexOf(layer) === this.layers.length - 1 ? 'disabled' : ''}>↓</button>
              <button onclick="LayerManager.deleteLayer('${layer.id}')"
                      class="small-button delete">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// Make LayerManager globally available
window.LayerManager = LayerManager;