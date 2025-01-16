import { room } from './room.js';
import { showNotification } from './notifications.js';

export class Project {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || 'Untitled Project';
    this.currentState = data.currentState || {
      imageUrl: null,
      imageData: null,
      prompt: null,
      selection: null
    };
    this.history = data.history || [];
    this.redoStack = [];
    this.username = data.username || room.party.client.username;
    this.created_at = data.created_at || new Date().toISOString();
    this.assets = data.assets || {};
  }

  static async create(initialState = {}) {
    const project = new Project({
      title: initialState.title || 'Untitled Project',
      currentState: initialState,
      history: [{
        type: 'create',
        state: initialState,
        timestamp: new Date().toISOString()
      }]
    });

    const saved = await room.collection('projects').create({
      title: project.title,
      currentState: project.currentState,
      history: project.history,
      assets: project.assets
    });

    project.id = saved.id;
    return project;
  }

  static async load(id) {
    const data = await room.collection('projects').get(id);
    if (!data) return null;
    return new Project(data);
  }

  async save() {
    if (!this.id) {
      const saved = await room.collection('projects').create(this.toJSON());
      this.id = saved.id;
      return saved;
    }
    return await room.collection('projects').update(this.id, this.toJSON());
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      currentState: this.currentState,
      history: this.history,
      assets: this.assets,
      username: this.username,
      created_at: this.created_at
    };
  }

  async addAction(action) {
    // Clear redo stack when new action is performed
    this.redoStack = [];
    
    // Create new history entry
    const historyEntry = {
      type: action.type,
      state: { ...this.currentState },
      timestamp: new Date().toISOString(),
      metadata: action.metadata || {}
    };

    // Add to history
    this.history.push(historyEntry);
    
    // Update current state
    this.currentState = { ...action.newState };

    // Save the project
    await this.save();
    
    // If this is an image generation/fill, store the asset
    if (action.type === 'generate' || action.type === 'fill') {
      this.assets[action.newState.imageUrl] = {
        prompt: action.metadata.prompt,
        timestamp: historyEntry.timestamp,
        type: action.type
      };
    }

    return historyEntry;
  }

  canUndo() {
    return this.history.length > 1; // Keep at least initial state
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  async undo() {
    if (!this.canUndo()) {
      showNotification('Nothing to undo', 'info');
      return null;
    }

    // Get current state and add to redo stack
    const currentEntry = this.history.pop();
    this.redoStack.push(currentEntry);

    // Set current state to previous state
    const previousEntry = this.history[this.history.length - 1];
    this.currentState = { ...previousEntry.state };

    await this.save();
    return previousEntry;
  }

  async redo() {
    if (!this.canRedo()) {
      showNotification('Nothing to redo', 'info');
      return null;
    }

    // Get next state from redo stack
    const nextEntry = this.redoStack.pop();
    
    // Add to history and update current state
    this.history.push(nextEntry);
    this.currentState = { ...nextEntry.state };

    await this.save();
    return nextEntry;
  }

  getAssetHistory(assetUrl) {
    return this.assets[assetUrl] || null;
  }
}