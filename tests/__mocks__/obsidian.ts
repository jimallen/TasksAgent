/**
 * Mock implementation of Obsidian API
 * Used in tests where Obsidian API is not available
 */

export const requestUrl = async (options: any) => ({
  status: 200,
  headers: {},
  text: '',
  json: {},
  arrayBuffer: new ArrayBuffer(0)
});

export const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

export class Notice {
  constructor(message: string, timeout?: number) {
    console.log(`Notice: ${message}`);
  }
}

export class TFile {
  path: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number; size: number };
  vault: any;

  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop() || '';
    this.extension = this.basename.split('.').pop() || '';
    this.stat = { ctime: Date.now(), mtime: Date.now(), size: 0 };
    this.vault = null;
  }
}

export class App {
  vault: any;
  workspace: any;
  metadataCache: any;

  constructor() {
    this.vault = {
      adapter: {
        exists: async () => false,
        mkdir: async () => undefined,
        write: async () => undefined,
        read: async () => ''
      },
      getAbstractFileByPath: () => null,
      create: async () => ({}),
      modify: async () => undefined,
      delete: async () => undefined,
      getMarkdownFiles: () => []
    };
    this.workspace = {
      getActiveFile: () => null,
      openLinkText: async () => undefined
    };
    this.metadataCache = {
      getFileCache: () => null
    };
  }
}

export class Plugin {
  app: App;
  manifest: any;

  constructor() {
    this.app = new App();
    this.manifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0'
    };
  }

  addCommand() {}
  addRibbonIcon() { return null; }
  addSettingTab() {}
  async loadData() { return {}; }
  async saveData() {}
  registerEvent() {}
  registerDomEvent() {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  display() {}
  hide() {}
}

export class Setting {
  private containerEl: any;

  constructor(containerEl: any) {
    this.containerEl = containerEl;
  }

  setName(name: string) { return this; }
  setDesc(desc: string) { return this; }
  setHeading() { return this; }
  setClass(cls: string) { return this; }
  addText(cb?: (text: any) => any) {
    const mock = {
      setValue: () => mock,
      setPlaceholder: () => mock,
      onChange: () => mock
    };
    if (cb) cb(mock);
    return this;
  }
  addTextArea(cb?: (text: any) => any) {
    const mock = {
      setValue: () => mock,
      setPlaceholder: () => mock,
      onChange: () => mock
    };
    if (cb) cb(mock);
    return this;
  }
  addToggle(cb?: (toggle: any) => any) {
    const mock = {
      setValue: () => mock,
      onChange: () => mock
    };
    if (cb) cb(mock);
    return this;
  }
  addDropdown(cb?: (dropdown: any) => any) {
    const mock = {
      addOption: () => mock,
      setValue: () => mock,
      onChange: () => mock
    };
    if (cb) cb(mock);
    return this;
  }
  addButton(cb?: (button: any) => any) {
    const mock = {
      setButtonText: () => mock,
      setCta: () => mock,
      setWarning: () => mock,
      onClick: () => mock
    };
    if (cb) cb(mock);
    return this;
  }
}

export class Modal {
  app: App;
  contentEl: any;

  constructor(app: App) {
    this.app = app;
    this.contentEl = {};
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

// Export other commonly used types/classes as needed
export const moment = () => ({
  format: () => '2025-01-27',
  unix: () => Date.now() / 1000
});
