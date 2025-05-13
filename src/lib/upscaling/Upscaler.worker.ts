import { renderUpscaled } from './models/upscaleMedium';

const getGpu = async () => {
    if (navigator.gpu == undefined) {
        return undefined;
    }

    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "low-power"
    });
    if (adapter === null) {
        return undefined;
    }

    const device = await adapter.requestDevice();
    return device;
}
const gpu = getGpu();

type Message = {
    image: ImageBitmap
}
onmessage = async (event: MessageEvent<Message>) => {
    const gpuResult = await gpu;
    if (gpuResult === undefined) {
        throw "BUG: Gpu is undefined, yet we're trying to upscale an image!";
    }

    const message = event.data;

    const upscaledResult = await renderUpscaled(gpuResult, message.image, "anime");

    self.postMessage({ image: upscaledResult });
}