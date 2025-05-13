import { getContext, setContext, tick } from "svelte";
import type { ActionReturn } from "svelte/action";

// TODO: A cool view-transition-like translation animation when we move the thumbnail back and forth.
// Why not just use view transitions? It's too slow and I'm not kidding.
type Lease = { thumbnail: HTMLImageElement, returnToOwner: () => void };
export default class ThumbnailCache {
    private thumbnails: Map<number, Lease> = new Map();

    public tryAcquireLease = (postId: number, into: HTMLElement) => {
        const maybeThumbnail = this.thumbnails.get(postId);

        if (maybeThumbnail === undefined) {
            return undefined;
        } else {
            this.thumbnails.delete(postId);
            maybeThumbnail.thumbnail.decoding = "sync";
            into.appendChild(maybeThumbnail.thumbnail);

            return maybeThumbnail
        }
    }

    public tryRegister = (postId: number, thumbnail: HTMLImageElement) => {
        if (!this.thumbnails.has(postId)) {
            const owningContainer = thumbnail.parentElement;
            if (owningContainer?.isConnected) {
                this.thumbnails.set(postId, {
                    thumbnail, returnToOwner: () => {
                        thumbnail.decoding = "async";
                        owningContainer.appendChild(thumbnail);
                        this.tryRegister(postId, thumbnail);
                    }
                });

                return true
            }
        }

        return false;
    }

    public invalidate = (postId: number, thumbnail: HTMLImageElement) => {
        thumbnail.decoding = "sync";

        if (this.thumbnails.get(postId)?.thumbnail === thumbnail) {
            this.thumbnails.delete(postId);
        }
    }
}

export const getThumbnailCache = () => {
    return getContext("thumbnail cache") as ThumbnailCache;
}
export const setThumbnailCache = (cache: ThumbnailCache) => {
    setContext("thumbnail cache", cache);
}

type CacheThumbnailOpts = { postId: number, cache: ThumbnailCache }
export const cacheThumbnail = (node: HTMLImageElement, opts: CacheThumbnailOpts): ActionReturn<CacheThumbnailOpts> => {
    opts.cache.tryRegister(opts.postId, node);

    return {
        destroy: () => {
            tick().then(() => {
                opts.cache.invalidate(opts.postId, node);
            });
        },
        update: (newOpts) => {
            opts.cache.invalidate(opts.postId, node);
            opts.cache.tryRegister(newOpts.postId, node);
            opts = newOpts;
        }
    };
}

type AcquireCachedThumbnailOpts = { postId: number, cache: ThumbnailCache }
export const acquireCachedThumbnail = (node: HTMLElement, opts: AcquireCachedThumbnailOpts): ActionReturn<AcquireCachedThumbnailOpts> => {
    let maybeLease = opts.cache.tryAcquireLease(opts.postId, node);

    return {
        destroy: () => {
            if (maybeLease === undefined) {
                return;
            }

            maybeLease.returnToOwner();
        },
        update: (newOpts) => {
            if (maybeLease !== undefined) {
                maybeLease.returnToOwner();
            }

            maybeLease = newOpts.cache.tryAcquireLease(newOpts.postId, node);
            opts = newOpts;
        }
    };
}