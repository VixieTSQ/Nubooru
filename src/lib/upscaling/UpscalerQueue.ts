import { getContext, setContext } from "svelte";
import UpscalerWorker from "./Upscaler.worker.ts?worker";
import { browser } from "$app/environment";

export class UpscalerQueue {
    private queue: Promise<string> | undefined = undefined;
    private worker: Worker | undefined = browser && navigator.gpu !== undefined ? new UpscalerWorker() : undefined;

    public execute(image: HTMLImageElement, abort: AbortSignal): Promise<string> {
        if (this.worker === undefined) {
            return new Promise(() => { });
        }

        if (this.queue === undefined) {
            this.queue = this.processNext(image, abort);
        } else {
            this.queue = this.queue.then(async () => await this.processNext(image, abort))
        }

        return this.queue;
    }

    private async processNext(image: HTMLImageElement, abort: AbortSignal) {
        if (abort.aborted) {
            return "";
        }

        const response: Promise<string> = new Promise((resolve) => {
            this.worker!.onmessage = async (event) => {
                const upscaledCanvas = document.createElement('canvas');
                const renderingContext = upscaledCanvas.getContext('bitmaprenderer');
                if (renderingContext === null) {
                    throw "Rendering context is null! What browser feature is this??"
                }

                const upscaledImage: ImageBitmap = event.data.image;
                renderingContext.transferFromImageBitmap(upscaledImage);

                resolve(upscaledCanvas.toDataURL());
            };
        })

        this.worker!.postMessage({
            image: await createImageBitmap(image)
        });

        return await response;
    }
}

export const setUpscaler = (value: UpscalerQueue) => {
    setContext('upscaler', value);
}

export const getUpscaler: () => UpscalerQueue = () => {
    return getContext('upscaler');
}