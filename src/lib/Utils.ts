import { getContext, setContext } from "svelte";
import type { Post, Tag } from "$lib/gelbooru";
import BezierEasing from "bezier-easing";

export const GELBOORU_ENDPOINT = "https://gelbooru.com/";

export const outerMainContainerId = "outer-main-container";
export const outerMainContainerSelector = `#${outerMainContainerId}`;
export const innerMainContainerId = "inner-main-container";
export const innerMainContainerSelector = `#${innerMainContainerId}`;

export const videoFileExtensions = ["webm", "mp4"];
export const animatedFileExtensions = ["gif", ...videoFileExtensions];

export const getUserProfilePictureUrl = (userId: number | undefined) => {
    return userId === undefined || userId === 6498 ? fallbackProfilePictureUrl : `${GELBOORU_ENDPOINT}user_avatars/avatar_${userId}.jpg`;
}
export const fallbackProfilePictureUrl = `${GELBOORU_ENDPOINT}user_avatars/honkonymous.png`;

export const reallyBackOut = BezierEasing(0.34, 1.53, 0.40, 1.3);

export const doesPreferLessMotion = () => window.matchMedia('(prefers-reduced-motion)').matches;

export const randomBetween = (max: number, min?: number) => {
    min = min ?? 0;
    return Math.random() * (max - min) + min;
}

export const copyHeaders = (from: Headers, ...toCopy: string[]): [string, string][] => {
    let output: [string, string][] = [];
    for (const key of toCopy) {
        const value = from.get(key);
        if (value === null) {
            continue;
        }

        output.push([key, value]);
    }

    return output;
}

export const getTagTypeFromTypeId = (id: number) => {
    if (id === 0) return "general";
    if (id === 1) return "artist";
    if (id === 3) return "copyright";
    if (id === 4) return "character";
    if (id === 5) return "metadata";
    if (id === 6) return "deprecated";

    console.warn(`Got tag with unknown type ${id}, substituting with general. Gelbooru update?`);
    return "general";
}
export const sortTags = (tags: Tag[]) => {
    const newTags: Tag[] = [];

    tags.forEach((tag) => { if (getTagTypeFromTypeId(tag.type) === "artist") newTags.push(tag); });
    tags.forEach((tag) => { if (getTagTypeFromTypeId(tag.type) === "character") newTags.push(tag); });
    tags.forEach((tag) => { if (getTagTypeFromTypeId(tag.type) === "copyright") newTags.push(tag); });
    tags.forEach((tag) => { if (getTagTypeFromTypeId(tag.type) === "metadata") newTags.push(tag); });
    tags.forEach((tag) => { if (getTagTypeFromTypeId(tag.type) === "general") newTags.push(tag); });
    tags.forEach((tag) => { if (getTagTypeFromTypeId(tag.type) === "deprecated") newTags.push(tag); });

    return newTags;
}

export const isPost = (data: unknown): data is Post => {
    return 'has_comments' in (data as any);
}

export const isUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

export const mapMaybePromise = <T, Y>(data: T | Promise<T>, transformation: (data: T) => Y): Y | Promise<Y> => {
    if (data instanceof Promise) {
        return data.then(transformation);
    } else {
        return transformation(data);
    }
};

export function assert(condition: unknown, message?: string): asserts condition {
    if (!condition) {
        throw new Error(message === undefined ? "Failed assertion" : `Failed assertion: ${message}`);
    }
}

export type StateContainer<T> = {
    value: T
}