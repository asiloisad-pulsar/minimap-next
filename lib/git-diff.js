/** @babel */

import { CompositeDisposable } from "atom";
import { observeMinimaps } from "./main";

const GUTTER_SETTING = "minimap-next.useGitDiffGutter";

/**
 * Returns the repository containing the passed-in path.
 *
 * @param {string} path The path of a file
 * @returns {Promise<GitRepository | null>} The repository, if any
 */
async function repositoryForPath(path) {
  if (path) {
    for (const directory of atom.project.getDirectories()) {
      if (path === directory.getPath() || directory.contains(path)) {
        return atom.project.repositoryForDirectory(directory);
      }
    }
  }
  return null;
}

/**
 * Converts a line diff from `GitRepository#getLineDiffs` to the class and the buffer rows to decorate.
 *
 * @param {Object} diff The line diff
 * @returns {{ cls: string; startRow: number; endRow: number }} The decoration description
 */
export function describeDiff({ oldLines, newStart, newLines }) {
  const startRow = newStart - 1;

  if (newLines === 0) {
    // the removed lines don't exist anymore: mark the row above them, or the first row if they were at the top
    const row = Math.max(startRow, 0);
    return { cls: "git-line-removed", startRow: row, endRow: row };
  }

  return {
    cls: oldLines === 0 ? "git-line-added" : "git-line-modified",
    startRow,
    endRow: startRow + newLines - 1,
  };
}

/** Keeps the git diff decorations of a single minimap up to date. */
class GitDiffBinding {
  /** @param {Minimap} minimap The minimap to decorate */
  constructor(minimap) {
    this.minimap = minimap;
    this.editor = minimap.getTextEditor();
    this.markerLayer = this.editor.addMarkerLayer();
    this.markers = [];
    this.repository = null;
    this.repositorySubscriptions = null;
    this.repositoryRequest = 0;

    this.subscriptions = new CompositeDisposable(
      this.editor.onDidChangePath(() => this.updateRepository()),
      atom.project.onDidChangePaths(() => this.updateRepository()),
      atom.config.onDidChange(GUTTER_SETTING, () => this.update()),
    );

    this.updateRepository();
  }

  /** Finds the repository of the editor's file and starts tracking it. */
  async updateRepository() {
    const request = ++this.repositoryRequest;
    const repository = await repositoryForPath(this.editor.getPath());

    // ignore the result if the binding was destroyed or a newer request was made in the meantime
    if (request !== this.repositoryRequest) {
      return;
    }

    this.clearRepository();
    this.repository = repository;

    if (repository) {
      this.repositorySubscriptions = new CompositeDisposable(
        this.editor.onDidStopChanging(() => this.update()),
        repository.onDidChangeStatuses(() => this.update()),
        repository.onDidChangeStatus(({ path }) => {
          if (path === this.editor.getPath()) {
            this.update();
          }
        }),
        repository.onDidDestroy(() => this.clearRepository()),
      );
    }

    this.update();
  }

  /** Stops tracking the current repository and removes its decorations. */
  clearRepository() {
    if (this.repositorySubscriptions) {
      this.repositorySubscriptions.dispose();
      this.repositorySubscriptions = null;
    }
    this.repository = null;
    this.removeMarkers();
  }

  /** Replaces the decorations with the current diffs of the editor's file. */
  update() {
    this.removeMarkers();

    const type = atom.config.get(GUTTER_SETTING) ? "gutter" : "line";
    for (const diff of this.getDiffs()) {
      const { cls, startRow, endRow } = describeDiff(diff);
      const marker = this.markerLayer.markBufferRange(
        [
          [startRow, 0],
          [endRow, Infinity],
        ],
        { invalidate: "never" },
      );
      this.markers.push(marker);
      this.minimap.decorateMarker(marker, {
        type,
        scope: `.minimap .${type} .${cls}`,
        plugin: "git-diff",
      });
    }
  }

  /** @returns {Object[]} The line diffs of the editor's file against the repository */
  getDiffs() {
    const path = this.editor.getPath();
    if (!this.repository || !path) {
      return [];
    }
    try {
      return this.repository.getLineDiffs(path, this.editor.getText()) || [];
    } catch (error) {
      return [];
    }
  }

  /** Destroys the markers, which also removes their decorations. */
  removeMarkers() {
    for (const marker of this.markers) {
      marker.destroy();
    }
    this.markers = [];
  }

  /** Removes the decorations and stops tracking the editor. */
  destroy() {
    this.repositoryRequest++;
    this.subscriptions.dispose();
    this.clearRepository();
    if (!this.editor.isDestroyed()) {
      this.markerLayer.destroy();
    }
  }
}

/** The built-in minimap plugin that highlights the git diffs of the edited file. */
export const gitDiffPlugin = {
  active: false,
  subscriptions: null,
  bindings: null,

  isActive() {
    return this.active;
  },

  activatePlugin() {
    if (this.active) {
      return;
    }
    this.active = true;
    this.bindings = new Map();
    this.subscriptions = new CompositeDisposable(
      observeMinimaps((minimap) => this.bind(minimap)),
    );
  },

  deactivatePlugin() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.subscriptions.dispose();
    this.bindings.forEach((binding) => binding.destroy());
    this.bindings = null;
  },

  /**
   * Creates the binding of the passed-in minimap, if it doesn't have one yet.
   *
   * @param {Minimap} minimap The minimap to decorate
   * @access private
   */
  bind(minimap) {
    if (this.bindings.has(minimap)) {
      return;
    }
    const binding = new GitDiffBinding(minimap);
    this.bindings.set(minimap, binding);

    const subscription = minimap.onDidDestroy(() => {
      binding.destroy();
      this.bindings.delete(minimap);
      this.subscriptions.remove(subscription);
      subscription.dispose();
    });
    this.subscriptions.add(subscription);
  },
};
