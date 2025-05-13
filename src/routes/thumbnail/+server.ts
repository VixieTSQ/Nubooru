import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { copyHeaders } from '$lib/Utils';

const acceptedDomains = [
    "img1.gelbooru.com",
    "img2.gelbooru.com",
    "img3.gelbooru.com",
    "img4.gelbooru.com",
    "youhate.us",
]

export const GET: RequestHandler = async ({ url, fetch }) => {
    let domain = url.searchParams.get("domain");
    if (domain === null) error(404);
    let file = url.searchParams.get("file");
    if (file === null || file === '') error(404);
    let directory1 = url.searchParams.get("directory1");
    if (directory1 === null || directory1 === '') error(404);
    let directory2 = url.searchParams.get("directory2");
    if (directory2 === null || directory2 === '') error(404);

    const sanitizedDomain = acceptedDomains.find((acceptedDomain) => acceptedDomain === domain);
    const requestUrl = new URL(`https://${sanitizedDomain}`);
    requestUrl.pathname = `/thumbnails/${encodeURIComponent(directory1)}/${encodeURIComponent(directory2)}/${encodeURIComponent(file)}`;

    const response = await fetch(requestUrl);
    if (!response.ok) {
        if (response.status === 404) {
            error(404);
        }

        error(502);
    }

    return new Response(response.body, {
        headers: copyHeaders(response.headers, "Etag", "Age", "Cache-Control", "Content-Type", "Date", "Expires", "Last-Modified")
    });
};