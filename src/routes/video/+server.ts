import { error } from '@sveltejs/kit';
import { copyHeaders } from '$lib/Utils';
import type { RequestHandler } from './$types';

const acceptedDomains = [
    "video-cdn1.gelbooru.com",
    "video-cdn2.gelbooru.com",
    "video-cdn3.gelbooru.com",
    "video-cdn4.gelbooru.com",
    "youhate.us",
]

export const GET: RequestHandler = async ({ url, request }) => {
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
    requestUrl.pathname = `/images/${encodeURIComponent(directory1)}/${encodeURIComponent(directory2)}/${encodeURIComponent(file)}`;

    const response = await fetch(requestUrl, {
        headers: copyHeaders(request.headers, "Accept", "Accept-Encoding", "Accept-Language", "Range")
    });
    if (!response.ok) {
        if (response.status === 404) {
            error(404);
        }

        error(502);
    }

    return new Response(response.body, {
        status: response.status,
        headers: copyHeaders(response.headers, "Cache-Control", "Content-Length", "Content-Range", "Content-Type", "Date", "Expires", "Last-Modified")
    });
};