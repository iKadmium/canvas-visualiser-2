import type { AudioPlayer } from './audioPlayer';
import type { SceneGraph } from './sceneGraph';

export interface IExporter {
	export: (canvas: HTMLCanvasElement, audioPlayer: AudioPlayer, frameRate: number, fromFrame: number, toFrame: number, sceneGraph: SceneGraph) => Promise<void>;
}
