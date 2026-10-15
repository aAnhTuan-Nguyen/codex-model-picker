import { contextBridge, ipcRenderer } from 'electron'
import { createBridge } from '../shared/contracts'
contextBridge.exposeInMainWorld('modelPicker', createBridge((channel, payload) => ipcRenderer.invoke(channel, payload)))
