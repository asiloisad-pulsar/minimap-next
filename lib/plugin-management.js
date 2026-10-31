/** @babel */

import { CompositeDisposable, Disposable } from "atom";
import { emitter, getConfigSchema } from "./main";

/**
 * Provides methods to manage minimap plugins. Minimap plugins are Atom packages that will augment the minimap. They
 * have a secondary activation cycle going on constrained by the minimap package activation. A minimap plugin life cycle
 * will generally look like this:
 *
 * 1. The plugin module is activated by Atom through the `activate` method
 * 2. The plugin then register itself as a minimap plugin using `registerPlugin`
 * 3. The plugin is activated/deactivated according to the minimap settings.
 * 4. On the plugin module deactivation, the plugin must unregisters itself from the minimap using the `unregisterPlugin`.
 *
 * @access public
 */

// Initialize the properties for plugin management.

/**
 * The registered Minimap plugins stored using their name as key.
 *
 * @type {Object}
 * @access private
 */
export const plugins = {};
/**
 * The plugins' subscriptions stored using the plugin names as keys.
 *
 * @type {Object}
 * @access private
 */
const pluginsSubscriptions = {};

/**
 * Registers a minimap `plugin` with the given `name`.
 *
 * @fires {did-add-plugin} with The name and a reference to the added plugin.
 * @fires {did-activate-plugin} if The plugin was activated during the registration.
 * @param {string} name The identifying name of the plugin. It will be used as activation settings name as well as the
 *   key to unregister the module.
 * @param {MinimapPlugin} plugin The plugin to register.
 * @returns {Disposable} Unregisters this plugin and releases its controls and subscriptions.
 */
export function registerPlugin(name, plugin) {
  if (plugins[name]) {
    unregisterPlugin(name);
  }

  plugins[name] = plugin;
  const subscriptions = new CompositeDisposable();
  pluginsSubscriptions[name] = subscriptions;

  const event = { name, plugin };
  emitter.emit("did-add-plugin", event);

  registerPluginControls(name);

  return new Disposable(() => {
    if (pluginsSubscriptions[name] === subscriptions) {
      unregisterPlugin(name);
    }
  });
}

/**
 * Unregisters a plugin from the minimap.
 *
 * @fires {did-remove-plugin} with The name and a reference to the added plugin.
 * @param {string} name The identifying name of the plugin to unregister.
 */
export function unregisterPlugin(name) {
  const plugin = plugins[name];
  if (!plugin) {
    return;
  }

  if (plugin.isActive()) {
    deactivatePlugin(name, plugin);
  }
  unregisterPluginControls(name);

  delete plugins[name];

  const event = { name, plugin };
  emitter.emit("did-remove-plugin", event);
}

/**
 * Toggles the specified plugin activation state.
 *
 * @fires {did-activate-plugin} if The plugin was activated by the call.
 * @fires {did-deactivate-plugin} if The plugin was deactivated by the call.
 * @param {string} name The name of the plugin.
 * @param {boolean} boolean An optional boolean to set the activation state of the plugin. If ommitted the new plugin
 *   state will be the the inverse of its current state.
 */
export function togglePluginActivation(name, boolean) {
  const settingsKey = `minimap-next.plugins.${name}`;

  if (boolean !== undefined && boolean !== null) {
    atom.config.set(settingsKey, boolean);
  } else {
    atom.config.set(settingsKey, !atom.config.get(settingsKey));
  }

  updatesPluginActivationState(name);
}

/**
 * Deactivates all the plugins registered in the minimap package so far.
 *
 * @fires {did-deactivate-plugin} for Each plugin deactivated by the call.
 */
export function deactivateAllPlugins() {
  for (const [name, plugin] of eachPlugin()) {
    plugin.deactivatePlugin();
    emitter.emit("did-deactivate-plugin", { name, plugin });
  }
}

/**
 * A generator function to iterate over registered plugins.
 *
 * @returns An iterable that yield the name and reference to every plugin as an array in each iteration.
 */
function* eachPlugin() {
  for (const name in plugins) {
    yield [name, plugins[name]];
  }
}

/**
 * Updates the plugin activation state according to the current config.
 *
 * @fires {did-activate-plugin} if The plugin was activated by the call.
 * @fires {did-deactivate-plugin} if The plugin was deactivated by the call.
 * @param {string} name The identifying name of the plugin to update.
 * @access private
 */
function updatesPluginActivationState(name) {
  const plugin = plugins[name];
  const pluginActive = plugin.isActive();
  const settingActive = atom.config.get(`minimap-next.plugins.${name}`);

  if (settingActive && !pluginActive) {
    activatePlugin(name, plugin);
  } else if (pluginActive && !settingActive) {
    deactivatePlugin(name, plugin);
  }
}

export function activatePlugin(name, plugin) {
  const event = { name, plugin };

  plugin.activatePlugin();
  emitter.emit("did-activate-plugin", event);
}

export function deactivatePlugin(name, plugin) {
  const event = { name, plugin };

  plugin.deactivatePlugin();
  emitter.emit("did-deactivate-plugin", event);
}

/**
 * Registers the commands and setting to manage plugin activation independently of the quick-settings button visibility.
 *
 * @param {string} name The identifying name of the plugin.
 * @param {MinimapPlugin} plugin The plugin instance to register controls for.
 * @listens {minimap-next.plugins.${name}} listen to the setting to update
 *          the plugin state accordingly.
 * @listens {minimap-next:toggle-${name}} listen to the command on `atom-workspace`
 *          to toggle the plugin state.
 * @access private
 */
function registerPluginControls(name) {
  const settingsKey = `minimap-next.plugins.${name}`;

  const config = getConfigSchema();

  config.plugins.properties[name] = {
    type: "boolean",
    title: name,
    description: `Whether the ${name} plugin is activated and displayed in the Minimap.`,
    default: true,
  };

  if (atom.config.get(settingsKey) === undefined) {
    atom.config.set(settingsKey, true);
  }

  pluginsSubscriptions[name].add(
    atom.config.observe(settingsKey, () => {
      updatesPluginActivationState(name);
    }),
  );

  pluginsSubscriptions[name].add(
    atom.commands.add("atom-workspace", {
      [`minimap-next:toggle-${name}`]: () => {
        togglePluginActivation(name);
      },
    }),
  );
}

/**
 * Unregisters the commands and setting created for a plugin.
 *
 * @param {string} name The identifying name of the plugin.
 * @access private
 */
function unregisterPluginControls(name) {
  pluginsSubscriptions[name].dispose();
  delete pluginsSubscriptions[name];
  delete getConfigSchema().plugins.properties[name];
}
