import { contextBridge, ipcRenderer } from 'electron';

/**
 * What the walkers page may ask of the desktop app, and nothing else: let clicks through
 * (or catch them over a banana), open the dashboard at an agent, show or hide the strip,
 * and hear when "Show walkers" is picked in the 🍌 menu.
 */
contextBridge.exposeInMainWorld('walkersHost', {
  setClickThrough(through: boolean): void {
    ipcRenderer.send('walkers:click-through', through);
  },
  openAgent(agentId: string): void {
    ipcRenderer.send('walkers:open', agentId);
  },
  setShown(shown: boolean): void {
    ipcRenderer.send('walkers:shown', shown);
  },
  onToggle(callback: () => void): () => void {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('walkers:toggle', listener);
    return () => {
      ipcRenderer.removeListener('walkers:toggle', listener);
    };
  },
});
