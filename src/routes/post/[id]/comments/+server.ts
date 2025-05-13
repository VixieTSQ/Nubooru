import { getPostComments } from '$lib/gelbooru';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
    const commentPage = Number(event.url.searchParams.get("comment-page")) ?? 0;
    if (Number.isNaN(commentPage)) error(400);

    const result = await getPostComments(event.fetch, event.params.id, commentPage);

    return json(result);
};