import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestTagsFor } from '$lib/gelbooru';

export const GET: RequestHandler = async (event) => {
    const like = event.url.searchParams.get("like");
    if (like === null) {
        error(400);
    }

    return json(await suggestTagsFor(event.fetch, like));
};