import { Muxer, FileSystemWritableFileStreamTarget } from 'webm-muxer';
import type { IExporter } from './exporter';
import type { AudioPlayer } from './audioPlayer';
import type { SceneGraph } from './sceneGraph';

export class EncoderExporter implements IExporter {
	public async export(canvas: HTMLCanvasElement, audioPlayer: AudioPlayer, frameRate: number, fromFrame: number, toFrame: number, sceneGraph: SceneGraph) {
		const handle = await window.showSaveFilePicker({
			types: [
				{
					accept: {
						'video/webm': ['.webm']
					},
					description: 'webm'
				}
			]
		});
		const writable = await handle.createWritable();

		const muxer = new Muxer({
			target: new FileSystemWritableFileStreamTarget(writable),
			video: {
				codec: 'V_VP9',
				width: canvas.width,
				height: canvas.height
			},
			audio: {
				codec: 'A_AAC/MPEG4/LC',
				numberOfChannels: audioPlayer.getChannelCount(),
				sampleRate: audioPlayer.getSampleRate()
			},
			firstTimestampBehavior: 'offset'
		});
		const duration = Math.floor(1_000_000 / frameRate);

		const videoEncoder = new VideoEncoder({
			output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
			error: (err) => {
				console.error(err);
			}
		});

		const videoCodec = 'vp09.00.10.08';

		const videoEncoderConfig: VideoEncoderConfig = {
			codec: videoCodec,
			width: canvas.width,
			height: canvas.height,
			framerate: frameRate
		};

		videoEncoder.configure(videoEncoderConfig);

		const audioEncoder = new AudioEncoder({
			output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
			error: (err) => console.error(err)
		});

		const audioEncoderConfig: AudioEncoderConfig = {
			codec: 'mp4a.40.2',
			numberOfChannels: audioPlayer.getChannelCount(),
			sampleRate: audioPlayer.getSampleRate()
		};

		audioEncoder.configure(audioEncoderConfig);

		let firstTimestamp: number | undefined;

		const bufferSource = audioPlayer.getAudioTrack();
		const audioBuffer = bufferSource.buffer!;
		const channelData: Float32Array[] = [];
		for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
			channelData.push(audioBuffer.getChannelData(i));
		}
		const samples = new Float32Array(channelData[0].length * channelData.length);
		for (let sample = 0; sample < audioBuffer.length; sample++) {
			for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
				const offset = audioBuffer.numberOfChannels * sample + channel;
				samples[offset] = channelData[channel][sample];
			}
		}

		const audioData = new AudioData({
			sampleRate: bufferSource.context.sampleRate,
			numberOfChannels: audioPlayer.getChannelCount(),
			data: samples,
			timestamp: 0,
			numberOfFrames: audioBuffer.length,
			format: 'f32'
		});
		audioEncoder.encode(audioData);

		for (let i = fromFrame; i < toFrame; i++) {
			sceneGraph.seek(i);
			sceneGraph.draw();
			const timestamp = Math.floor((1_000_000 * i) / frameRate);
			const frame = new VideoFrame(canvas, { timestamp: timestamp + (firstTimestamp ?? 0), duration });
			const keyFrame = i % frameRate === 0;
			videoEncoder.encode(frame, { keyFrame });
			frame.close();
			await videoEncoder.flush();
		}
		muxer.finalize();
		await writable.close();
	}
}
