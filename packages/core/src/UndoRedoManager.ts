import type { SpreadsheetState } from "./types/SpreadsheetState";

export interface StateSnapshot {
  id: string;
  timestamp: number;
  state: SpreadsheetState;
  description?: string;
  parentId?: string;
  childIds: string[];
}

export interface UndoRedoOptions {
  maxHistorySize?: number;
  enableCompression?: boolean;
}

export class UndoRedoManager {
  private snapshots: Map<string, StateSnapshot> = new Map();
  private currentSnapshotId: string | null = null;
  private rootSnapshotId: string | null = null;
  private options: Required<UndoRedoOptions>;

  constructor(options: UndoRedoOptions = {}) {
    this.options = {
      maxHistorySize: options.maxHistorySize ?? 100,
      enableCompression: options.enableCompression ?? false,
    };
  }

  recordState(state: SpreadsheetState, description?: string): void {
    const id = this.generateId();
    const timestamp = Date.now();

    const snapshot: StateSnapshot = {
      id,
      timestamp,
      state: this.cloneState(state),
      description,
      parentId: this.currentSnapshotId,
      childIds: [],
    };

    // If this is the first snapshot
    if (!this.rootSnapshotId) {
      this.rootSnapshotId = id;
    }

    // Update parent's children
    if (this.currentSnapshotId) {
      const parent = this.snapshots.get(this.currentSnapshotId);
      if (parent) {
        // If we're branching (parent already has children), we're creating a new branch
        // Otherwise, we're continuing the same branch
        parent.childIds.push(id);
      }
    }

    this.snapshots.set(id, snapshot);
    this.currentSnapshotId = id;

    // Enforce history size limit
    this.pruneHistory();
  }

  undo(): SpreadsheetState | null {
    if (!this.canUndo()) {
      return null;
    }

    if (!this.currentSnapshotId) {
      return null;
    }

    const current = this.snapshots.get(this.currentSnapshotId);
    if (!current || !current.parentId) {
      return null;
    }

    const parent = this.snapshots.get(current.parentId);
    if (!parent) {
      return null;
    }

    this.currentSnapshotId = parent.id;
    return this.cloneState(parent.state);
  }

  redo(): SpreadsheetState | null {
    if (!this.canRedo()) {
      return null;
    }

    if (!this.currentSnapshotId) {
      return null;
    }

    const current = this.snapshots.get(this.currentSnapshotId);
    if (!current || current.childIds.length === 0) {
      return null;
    }

    // For now, we'll use the most recent child (last one added)
    // In the future, we could provide branch selection UI
    const childId = current.childIds[current.childIds.length - 1];
    const child = this.snapshots.get(childId);
    if (!child) {
      return null;
    }

    this.currentSnapshotId = child.id;
    return this.cloneState(child.state);
  }

  canUndo(): boolean {
    if (!this.currentSnapshotId) {
      return false;
    }

    const current = this.snapshots.get(this.currentSnapshotId);
    return !!current?.parentId;
  }

  canRedo(): boolean {
    if (!this.currentSnapshotId) {
      return false;
    }

    const current = this.snapshots.get(this.currentSnapshotId);
    return !!(current && current.childIds.length > 0);
  }

  getHistory(): StateSnapshot[] {
    const history: StateSnapshot[] = [];
    const visited = new Set<string>();

    const traverse = (id: string | null) => {
      if (!id || visited.has(id)) {
        return;
      }

      visited.add(id);
      const snapshot = this.snapshots.get(id);
      if (snapshot) {
        history.push(snapshot);
        snapshot.childIds.forEach(traverse);
      }
    };

    traverse(this.rootSnapshotId);
    return history.sort((a, b) => a.timestamp - b.timestamp);
  }

  getCurrentSnapshot(): StateSnapshot | null {
    return this.currentSnapshotId
      ? this.snapshots.get(this.currentSnapshotId) || null
      : null;
  }

  clear(): void {
    this.snapshots.clear();
    this.currentSnapshotId = null;
    this.rootSnapshotId = null;
  }

  private generateId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private cloneState(state: SpreadsheetState): SpreadsheetState {
    // Deep clone the state to prevent mutations
    // This is a simple implementation - could be optimized with structural sharing
    return JSON.parse(JSON.stringify(state));
  }

  private pruneHistory(): void {
    if (this.snapshots.size <= this.options.maxHistorySize) {
      return;
    }

    // Get all snapshots sorted by timestamp
    const allSnapshots = Array.from(this.snapshots.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    // Keep the most recent snapshots up to maxHistorySize
    const toKeep = new Set(
      allSnapshots.slice(-this.options.maxHistorySize).map((s) => s.id),
    );

    // Always keep the current snapshot and its ancestors
    let currentId: string | null = this.currentSnapshotId;
    while (currentId) {
      toKeep.add(currentId);
      const snapshot = this.snapshots.get(currentId);
      currentId = snapshot?.parentId || null;
    }

    // Remove old snapshots
    for (const snapshot of allSnapshots) {
      if (!toKeep.has(snapshot.id)) {
        this.snapshots.delete(snapshot.id);

        // Update parent's children list
        if (snapshot.parentId) {
          const parent = this.snapshots.get(snapshot.parentId);
          if (parent) {
            parent.childIds = parent.childIds.filter(
              (id) => id !== snapshot.id,
            );
          }
        }

        // Update root if necessary
        if (this.rootSnapshotId === snapshot.id) {
          this.rootSnapshotId = snapshot.childIds[0] || null;
        }
      }
    }
  }
}
