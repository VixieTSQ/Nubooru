import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, depends, url }) => {
    let user = undefined;
    if (locals.userCredentials !== undefined) {
        user = {
            id: Number(locals.userCredentials.userId)
        };
    }

    if (url.searchParams.get("signin") === "true" && user !== undefined) {
        redirect(307, "?signin=false");
    }

    depends("data:user");
    return {
        user
    };
}) satisfies LayoutServerLoad;