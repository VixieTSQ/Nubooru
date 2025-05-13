import { passHashCookieKey, userIdCookieKey } from '$lib/gelbooru';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
    if (event.locals.userCredentials === undefined) {
        error(401);
    }

    event.cookies.delete(userIdCookieKey, {
        path: '/'
    });
    event.cookies.delete(passHashCookieKey, {
        path: '/'
    });

    return new Response(null, {
        status: 200
    });
};