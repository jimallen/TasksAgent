import { Plugin } from 'obsidian';
import MeetingTasksPlugin from './main';

describe('MeetingTasksPlugin', () => {
  it('should be a valid Obsidian plugin', () => {
    expect(MeetingTasksPlugin.prototype).toBeInstanceOf(Plugin);
  });

  it('should have required lifecycle methods', () => {
    const plugin = MeetingTasksPlugin.prototype;
    expect(plugin.onload).toBeDefined();
    expect(plugin.onunload).toBeDefined();
  });
});