import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import { RecordingState } from '../shared/types';
import { createLogger } from './utils/logger';

const log = createLogger('tray');

let tray: Tray | null = null;

interface TrayCallbacks {
  onToggleRecording: () => void;
  onShowSettings: () => void;
  onQuit: () => void;
}

export function createTray(callbacks: TrayCallbacks): Tray {
  const iconPath = join(__dirname, '../../resources/icons/tray-icon.png');

  // Create a simple 16x16 tray icon if the file doesn't exist
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    // Create a simple colored square as fallback
    icon = nativeImage.createFromBuffer(createFallbackIcon());
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('VoiceFlow — Voice Dictation');

  updateTrayMenu('idle', callbacks);

  log.info('System tray created');
  return tray;
}

export function updateTrayState(state: RecordingState, callbacks: TrayCallbacks): void {
  if (!tray) return;

  const tooltips: Record<RecordingState, string> = {
    idle: 'VoiceFlow — Ready',
    recording: 'VoiceFlow — Recording...',
    processing: 'VoiceFlow — Processing...',
  };

  tray.setToolTip(tooltips[state]);
  updateTrayMenu(state, callbacks);
}

function updateTrayMenu(state: RecordingState, callbacks: TrayCallbacks): void {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    {
      label: state === 'recording' ? 'Stop Recording' : 'Start Recording',
      enabled: state !== 'processing',
      click: callbacks.onToggleRecording,
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: callbacks.onShowSettings,
    },
    { type: 'separator' },
    {
      label: `VoiceFlow v${app.getVersion?.() || '1.0.0'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: callbacks.onQuit,
    },
  ]);

  tray.setContextMenu(menu);
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

// Create a simple 16x16 PNG fallback icon (blue microphone dot)
function createFallbackIcon(): Buffer {
  // Minimal 16x16 RGBA PNG — solid blue circle
  // This is a pre-computed minimal PNG for a blue dot icon
  const width = 16;
  const height = 16;
  const channels = 4;
  const rawData = Buffer.alloc(width * height * channels, 0);

  // Draw a simple circle
  const cx = 8, cy = 8, r = 6;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const idx = (y * width + x) * channels;
      if (dist <= r) {
        rawData[idx] = 66;     // R
        rawData[idx + 1] = 133; // G
        rawData[idx + 2] = 244; // B
        rawData[idx + 3] = 255; // A
      }
    }
  }

  return nativeImage.createFromBuffer(rawData, { width, height }).toPNG();
}
