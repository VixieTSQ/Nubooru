import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTagDescription } from '$lib/gelbooru';

export const GET: RequestHandler = async (event) => {
    const tagName = event.url.searchParams.get("name");
    if (tagName === null) {
        error(400);
    }

    const description = await getTagDescription(event.fetch, tagName);
    if (description === undefined) {
        error(404);
    }

    return json(description);
};