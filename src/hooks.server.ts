import { passHashCookieKey, userIdCookieKey } from '$lib/gelbooru';
import { GELBOORU_ENDPOINT } from '$lib/Utils';
import type { Handle, HandleFetch } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const userId = event.cookies.get(userIdCookieKey);
    const passHash = event.cookies.get(passHashCookieKey);
    if (userId !== undefined && passHash !== undefined) {
        event.locals.userCredentials = {
            userId,
            passHash
        };
    }

    const response = await resolve(event);

    return response;
};

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
    if (new URL(request.url).origin === GELBOORU_ENDPOINT.slice(0, -1) && event.locals.userCredentials !== undefined) {
        request.headers.set('Cookie', `${userIdCookieKey}=${encodeURIComponent(event.locals.userCredentials.userId)}; ${passHashCookieKey}=${encodeURIComponent(event.locals.userCredentials.passHash)}; fringeBenefits=yup;`);
    }

    return fetch(request);
};