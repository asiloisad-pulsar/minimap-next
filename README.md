# minimap-next

A preview of the full source code.

Fork of [minimap](https://github.com/atom-minimap/minimap).

## Features

- **Canvas rendering**: Three-layer canvas (back decorations, tokens, front decorations) with incremental redraws — only changed row ranges are repainted.
- **Syntax highlighting**: Token colors are resolved directly from the active theme via computed DOM styles and cached per scope, so the minimap matches the editor exactly.
- **Git diff**: Added, modified and removed lines are highlighted, as full lines or as thin gutter marks. Toggle it with the `git-diff` entry in quick settings or the `minimap-next:toggle-git-diff` command.
- **Scroll past end**: The minimap proportionally tracks the full editor scroll range, including the scroll-past-end zone.
- **Decoration API**: Uses the same marker-based API as `TextEditor` — supports `line`, `gutter`, `highlight-under`, `highlight-over`, `highlight-outline`, and `background-custom`/`foreground-custom` types.
- **Plugin system**: Third-party packages can consume the `minimap-next` service to add their own decoration layers.
- **Quick settings**: Toggle plugins and flip the minimap position via a dropdown on the minimap itself.
- **Stand-alone mode**: Embed a minimap preview outside of a text editor for custom UI panels.
- **Independent scroll**: Optionally decouple mouse-wheel scrolling on the minimap from the editor.

## Installation

To install `minimap-next` search for [minimap-next](https://web.pulsar-edit.dev/packages/minimap-next) in the Install pane of the Pulsar settings or run `ppm install minimap-next`. Alternatively, you can run `ppm install asiloisad-pulsar/minimap-next` to install a package directly from the GitHub repository.

## Customization

The style can be adjusted according to user preferences in the `styles.less` file:

- e.g. hide the default editor scrollbar:

```less
atom-text-editor[with-minimap] .vertical-scrollbar {
  display: none;
}
```

- e.g. change the minimap background:

```less
atom-text-editor atom-text-editor-minimap {
  background: green;
}
```

- e.g. change the visible area color:

```less
atom-text-editor atom-text-editor-minimap .minimap-visible-area::after {
  background-color: rgba(0, 255, 0, 0.5);
}
```

- e.g. show minimap only in the focused pane:

```less
atom-text-editor {
  atom-text-editor-minimap {
    display: none;
  }
  &.is-focused {
    atom-text-editor-minimap {
      display: block;
    }
  }
}
```

## Provided Service `minimap-next`

Exposes the minimap API to other packages, allowing them to add decorations and interact with the minimap.

In your `package.json`:

```json
{
  "consumedServices": {
    "minimap-next": {
      "versions": { "1.0.0": "consumeMinimap" }
    }
  }
}
```

In your main module:

```javascript
consumeMinimap(api) {
  api.observeMinimaps((minimap) => {
    const decoration = minimap.decorateMarker(marker, {
      type: "line",
      color: "#ff0000",
      plugin: "my-plugin",
    });
  });
}
```

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
