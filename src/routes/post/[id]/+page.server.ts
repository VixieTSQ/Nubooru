import { favoritePost, flagComment, flagPost, getPost, getPostInfo, getTags, passHashCookieKey, unfavoritePost, upvoteComment, upvotePost, userIdCookieKey } from '$lib/gelbooru';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
    const commentPage = Number(event.url.searchParams.get("comment-page")) ?? 0;

    if (Number.isNaN(commentPage)) error(400);

    const post = await getPost(event.fetch, event.params.id);
    const tags = getTags(event.fetch, post.tags);
    const postInfo = getPostInfo(event.fetch, event.params.id, commentPage)

    const extra = Promise.all([tags, postInfo]).then(([tags, postInfo]) => {
        return {
            tags,
            ...postInfo
        };
    });
    const extraMaybePromise = event.isDataRequest ? extra : await extra;

    return {
        post,
        extra: extraMaybePromise as typeof extraMaybePromise | undefined
    };
}) satisfies PageServerLoad;

export const actions = {
    heart: async (event) => {
        if (event.locals.userCredentials === undefined) {
            error(401);
        }

        const postId = Number(event.params.id);
        if (Number.isNaN(postId)) error(400);

        return { hearts: await upvotePost(event.fetch, postId) };
    },
    favorite: async (event) => {
        if (event.locals.userCredentials === undefined) {
            error(401);
        }

        const postId = Number(event.params.id);
        if (Number.isNaN(postId)) error(400);

        const hearts = await upvotePost(event.fetch, postId);
        const result = await favoritePost(event.fetch, postId);

        if (result === 'Unauthorized') {
            event.cookies.delete(userIdCookieKey, {
                path: '/'
            });
            event.cookies.delete(passHashCookieKey, {
                path: '/'
            });

            error(401);
        }

        return { hearts };
    },
    unfavorite: async (event) => {
        if (event.locals.userCredentials === undefined) {
            error(401);
        }

        const postId = Number(event.params.id);
        if (Number.isNaN(postId)) error(400);

        await unfavoritePost(event.fetch, postId);

        return;
    },
    reportPost: async (event) => {
        if (event.locals.userCredentials === undefined) {
            error(401);
        }

        const postId = Number(event.params.id);
        if (Number.isNaN(postId)) error(400);

        const data = await event.request.formData();
        const reason = data.get("reason");

        if (reason === null || reason.toString() === '') {
            return fail(400, {
                success: false,
                reason: {
                    value: (reason ?? "").toString(),
                    error: "A reason is required"
                }
            });
        }

        await flagPost(event.fetch, postId, reason.toString());

        return { success: true }
    },

    heartComment: async (event) => {
        if (event.locals.userCredentials === undefined) {
            error(401);
        }

        const postId = Number(event.params.id);
        if (Number.isNaN(postId)) error(400);

        const data = await event.request.formData();
        const commentId = Number(data.get("comment ID")?.toString());

        if (Number.isNaN(commentId)) {
            return fail(400, {
                success: false,
                commentId: {
                    error: "A comment id is required"
                }
            });
        }

        const hearts = await upvoteComment(event.fetch, commentId, postId);

        return { success: true, hearts }
    },
    reportComment: async (event) => {
        if (event.locals.userCredentials === undefined) {
            error(401);
        }

        const data = await event.request.formData();
        const reason = data.get("reason");
        const commentId = Number(data.get("comment ID")?.toString());

        if (reason === null || reason.toString() === '') {
            return fail(400, {
                success: false,
                reason: {
                    value: (reason ?? "").toString(),
                    error: "A reason is required"
                }
            });
        }

        if (Number.isNaN(commentId)) {
            return fail(400, {
                success: false,
                reason: {
                    value: reason.toString(),
                },
                commentId: {
                    error: "A comment id is required"
                }
            });
        }

        await flagComment(event.fetch, commentId, reason.toString());

        return { success: true }
    }
} satisfies Actions;