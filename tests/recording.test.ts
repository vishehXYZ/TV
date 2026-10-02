import { describe, it, expect, vi, beforeEach } from 'vitest';
const convert = vi.hoisted(() => vi.fn());
vi.mock('../src/recording/Mp4Transcoder', () => ({ Mp4Transcoder: class {webmToMp4 = convert; cancel = vi.fn();} }));
import { CanvasRecorder } from '../src/recording/CanvasRecorder';
class FakeRecorder {
 static isTypeSupported(type: string) {return type === 'video/mp4';}
 mimeType = 'video/mp4'; ondataavailable: ((e: {data: Blob}) => void) | null = null; onstop: (() => void) | null = null;
 start() {} stop() {this.ondataavailable?.({data:new Blob(['recorded'],{type:this.mimeType})}); this.onstop?.();}
}
function fixture() {
 const stop = vi.fn();
 const canvas = {captureStream: () => ({getVideoTracks: () => [{stop}]})} as unknown as HTMLCanvasElement;
 return {recorder: new CanvasRecorder(canvas),stop};
}
beforeEach(() => {vi.stubGlobal('MediaRecorder',FakeRecorder); vi.stubGlobal('MediaStream',class {constructor(_tracks: unknown[]) {}}); convert.mockReset();});
describe('MP4 recording contract', () => {
 it('exports MP4 and releases only capture tracks', async () => { convert.mockResolvedValue(new Blob(['mp4'],{type:'video/mp4'})); const {recorder,stop}=fixture(); recorder.start(); const output=await recorder.stop(); expect(output.filename).toMatch(/\.mp4$/); expect(output.blob.type).toBe('video/mp4'); expect(stop).toHaveBeenCalledOnce(); expect(recorder.state).toBe('idle'); });
 it('reports conversion failure without downloading WebM', async () => {convert.mockRejectedValue(new Error('conversion failed')); const {recorder}=fixture(); recorder.start(); await expect(recorder.stop()).rejects.toThrow('conversion failed'); expect(recorder.state).toBe('idle');});
 it('cancels a take without conversion', async () => {const {recorder,stop}=fixture(); recorder.start(); await recorder.cancel(); expect(convert).not.toHaveBeenCalled(); expect(stop).toHaveBeenCalledOnce(); expect(recorder.state).toBe('idle');});
});
