import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPosts } from '$lib/gelbooru';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
    const tags = event.url.searchParams.get("tags") ?? undefined;
    const page = parseInt(event.url.searchParams.get("page") ?? '0');
    if (isNaN(page)) {
        error(400);
    }

    return json(await getPosts(event.fetch, page, tags));
};