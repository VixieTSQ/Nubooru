import { error, fail, redirect } from '@sveltejs/kit';
import { getPosts, passHashCookieKey, tryLogin, userIdCookieKey } from '$lib/gelbooru';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ url, fetch, depends, isDataRequest }) => {
    const tags = url.searchParams.get("tags") ?? undefined;
    const page = parseInt(url.searchParams.get("page") ?? '0');
    if (isNaN(page)) {
        error(400);
    }

    const posts = getPosts(fetch, page, tags);
    depends("data:posts")

    return {
        posts: isDataRequest ? posts : await posts
    };
}) satisfies PageServerLoad;

export const actions = {
    signin: async ({ request, fetch, cookies, locals }) => {
        if (locals.userCredentials !== undefined) {
            return fail(400, {
                success: false,
                error: "You are already signed in. Please refresh"
            });
        }

        const data = await request.formData();
        const username = data.get("username");
        const password = data.get("password");

        if (username === null || username.toString() === '') {
            return fail(400, {
                success: false,
                username: {
                    value: (username ?? "").toString(),
                    error: "A username is required"
                }
            });
        }
        if (password === null || password.toString() === '') {
            return fail(400, {
                success: false,
                password: {
                    error: "A password is required"
                },
                username: {
                    value: username.toString(),
                }
            });
        }

        const loginResponse = await tryLogin(fetch, username.toString(), password.toString());
        if (loginResponse === undefined) {
            return fail(400, {
                success: false,
                error: "Incorrect username or password",
                username: {
                    value: username.toString(),
                }
            });
        }

        loginResponse.forEach((cookie) => {
            if (cookie.name !== userIdCookieKey && cookie.name !== passHashCookieKey) {
                return;
            }

            cookies.set(cookie.name, cookie.value, {
                expires: cookie.expires,
                maxAge: cookie.maxAge,
                path: "/",
                sameSite: cookie.sameSite as any
            });
        });

        redirect(303, "?signin=false");
    }
} satisfies Actions;