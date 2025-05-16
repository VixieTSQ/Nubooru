import { error } from '@sveltejs/kit';
import { JSDOM } from 'jsdom';
import setCookies from 'set-cookie-parser';
import he from 'he';
import { assert, GELBOORU_ENDPOINT as ENDPOINT } from './Utils';
import type { DOMWindow } from 'jsdom';

export const userIdCookieKey = "user_id";
export const passHashCookieKey = "pass_hash";

const transformPost = (post: Post): Post => {
    return {
        ...post,
        tags: he.decode(post.tags)
    }
}

export const getPosts = async (fetch: typeof globalThis.fetch, page: number = 0, tags?: string): Promise<Post[]> => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=dapi&s=post&q=index&json=1&ordering=1");
    requestUrl.searchParams.set("pid", String(page));
    if (tags !== undefined) requestUrl.searchParams.set("tags", tags);
    let response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    const posts: Posts = await response.json();
    return posts.post?.map(transformPost) ?? [];
}

export const getPost = async (fetch: typeof globalThis.fetch, id: string | number): Promise<Post> => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=dapi&s=post&q=index&json=1");
    requestUrl.searchParams.set("id", String(id));
    let response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    let posts = await response.json();
    if (posts.post[0] === undefined) {
        error(404);
    }

    return transformPost(posts.post[0]);
}

// TODO: We should scrape this from the post page instead so we don't have to make this extra fetch.
export const getTags = async (fetch: typeof globalThis.fetch, tags: string): Promise<Tag[]> => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=dapi&s=tag&q=index&json=1&orderby=count&limit=500");
    requestUrl.searchParams.set("names", tags);
    let response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    const responseTags: Tag[] = (await response.json()).tag;
    return responseTags.map((tag) => {
        return {
            ...tag,
            name: he.decode(tag.name)
        }
    });
}

const getPostPage = async (fetch: typeof globalThis.fetch, postId: number | string, page: number) => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=post&s=view");
    requestUrl.searchParams.set("id", String(postId));
    requestUrl.searchParams.set("pid", String(page * 10));
    let response = await fetch(requestUrl, {
        redirect: "manual"
    });
    if (response.status <= 399 && response.status >= 300) {
        error(404);
    }
    if (!response.ok) {
        error(502);
    }

    const { window } = new JSDOM(await response.arrayBuffer(), {
        url: response.url,
    });

    return window;
}

export const getPostInfo = async (svelteFetch: typeof globalThis.fetch, postId: number | string, page: number = 0) => {
    const window = await getPostPage(svelteFetch, postId, page);

    const document = window.document;
    const mainContainerElement = document.querySelector(".mainBodyPadding");
    if (mainContainerElement === null) error(502);

    const { comments, maxCommentPage } = await getPostComments(window, postId, page);

    const actionsContainerElement = mainContainerElement.querySelector("#scrollebox");
    const favoriteElement = actionsContainerElement?.querySelector("a:nth-of-type(3)");
    const favoriteElementText = favoriteElement?.textContent
    if (favoriteElementText === null || favoriteElementText === undefined) error(502);
    const isFavorited = favoriteElementText === "Unfavorite";

    const tagsContainerElement = document.querySelector("#tag-list");
    if (tagsContainerElement === null) error(502);
    let hearts: number | undefined = undefined;
    for (const item of tagsContainerElement.childNodes.values()) {
        const textContent = item.textContent;

        if (textContent?.startsWith("Score: ")) {
            const result = parseInt(textContent.slice(7));
            if (Number.isNaN(result)) error(502);
            hearts = result;
            break;
        }
    }
    if (hearts === undefined) error(502);

    const notesContainerElement = mainContainerElement.querySelector("#notes");
    const imageElement = mainContainerElement.querySelector(".image-container");
    if (notesContainerElement === null) error(502);
    let translations: Translation[] = [];
    if (imageElement !== null) {
        const imageWidth = Number(imageElement.attributes.getNamedItem("data-width")?.value);
        const imageHeight = Number(imageElement.attributes.getNamedItem("data-height")?.value);
        if (Number.isNaN(imageWidth) || Number.isNaN(imageHeight)) error(502);
        translations = scrapeTranslations(notesContainerElement, window, imageWidth, imageHeight);
    }

    const suggestedPostsElement = mainContainerElement.querySelector("form ~ div");
    if (suggestedPostsElement === null) error(502);
    const suggestedPostElements: NodeListOf<HTMLAnchorElement> = suggestedPostsElement.querySelectorAll("a");
    const suggestedPostIds: number[] = [];

    suggestedPostElements.forEach((suggestedPostElement) => {
        const id = Number(new URL(suggestedPostElement.href).searchParams.get("id"));
        if (Number.isNaN(id)) error(502);
        suggestedPostIds.push(id);
    });
    const suggestedPosts = await Promise.all(suggestedPostIds.map((postId) => getPost(fetch, postId)));

    return {
        maxCommentPage,
        comments,
        suggestedPosts,
        isFavorited,
        hearts,
        translations
    }
}

export const getPostComments = async (data: typeof globalThis.fetch | DOMWindow, postId: number | string, page: number = 0) => {
    let window;
    if (data instanceof Function) {
        window = await getPostPage(data, postId, page);
    } else {
        window = data;
    }

    const document = window.document;
    const mainContainerElement = document.querySelector(".mainBodyPadding");
    if (mainContainerElement === null) error(502);

    const commentElements = mainContainerElement.querySelectorAll("h2 ~ div");
    const comments: Comment[] = [];
    commentElements.forEach((comment) => {
        comments.push(scrapeComment(comment, window));
    });

    const paginationElement = document.querySelector(".pagination");
    if (paginationElement === null) error(502);
    let maxCommentPage = 0;
    paginationElement.childNodes.forEach((node) => {
        const page = Number(node.textContent);
        if (Number.isNaN(page)) return;
        maxCommentPage = Math.max(maxCommentPage, page - 1);
    });

    return { comments, maxCommentPage };
}

const scrapeComment = (comment: Element, window: DOMWindow): Comment => {
    const avatarElement = comment.querySelector('.profileAvatar');
    if (avatarElement === null) error(502);
    const authorProfilePictureUrl = new URL(window.getComputedStyle(avatarElement).backgroundImage.slice(4, -1).replace(/"/g, ""), ENDPOINT).toString();

    const bodyElement = comment.querySelector('.commentBody');
    if (bodyElement === null) error(502);

    const usernameElement = bodyElement.querySelector("a");
    if (usernameElement === null) error(502);
    const authorId = Number(new URL(usernameElement.href).searchParams.get("id"));
    if (Number.isNaN(authorId)) error(502);
    const authorUsername = usernameElement.textContent;
    if (authorUsername === null) error(502);

    let dateMs: number | undefined = undefined;
    let id: number | undefined = undefined;
    let content = "";
    bodyElement.childNodes.forEach((node) => {
        if (node.nodeName === "BR" && !content.endsWith('\n\n')) {
            content = content + "\n"
        }
        if (node.nodeType !== node.TEXT_NODE) {
            return;
        }
        let textContent = node.textContent;
        if (textContent === null) error(502);
        textContent = textContent.trim();
        if (textContent === "") return;

        if (dateMs === undefined) {
            const stringDate = textContent.slice(13, 33);
            dateMs = Date.parse(stringDate);

            const stringId = textContent.slice(36);
            id = Number(stringId);
        } else {
            content = content + textContent + '\n';
        }
    });
    if (dateMs === undefined || Number.isNaN(dateMs) || id === undefined || Number.isNaN(id)) error(502);
    content = content.trim();

    const voteCountText = bodyElement.querySelector(".info > span")?.textContent ?? null;
    if (voteCountText === null) error(502);
    const hearts = Number(voteCountText);
    if (Number.isNaN(hearts)) error(502);

    const isFlagged = bodyElement.querySelector(".info:nth-of-type(2) > b") !== null;

    return {
        id,
        authorProfilePictureUrl,
        authorId,
        authorUsername,
        dateMs,
        content,
        hearts,
        isFlagged
    };
}

const scrapeTranslations = (translationsElement: Element, window: DOMWindow, imageWidth: number, imageHeight: number): Translation[] => {
    const translationElements = translationsElement.querySelectorAll("article");
    const translations = translationElements.values().map((translationElement) => {
        const id = Number(translationElement.attributes.getNamedItem("data-id")?.value);
        const width = Number(translationElement.attributes.getNamedItem("data-width")?.value);
        const height = Number(translationElement.attributes.getNamedItem("data-height")?.value);
        const x = Number(translationElement.attributes.getNamedItem("data-x")?.value);
        const y = Number(translationElement.attributes.getNamedItem("data-y")?.value);
        const bodyRaw = translationElement.attributes.getNamedItem("data-body")?.value;
        if (Number.isNaN(id) || Number.isNaN(width) || Number.isNaN(height) || Number.isNaN(x) || Number.isNaN(y) || bodyRaw === undefined) {
            error(502);
        }

        console.log(bodyRaw);

        const bodyFragment = JSDOM.fragment(`<div>${bodyRaw}</div>`);
        const body = bodyFragment.childNodes.values()
            .filter((node) => node.nodeType === node.ELEMENT_NODE || node.nodeType === node.TEXT_NODE)
            .map(parseTranslationContents).toArray();

        const scaleX = 100 / imageWidth;
        const scaleY = 100 / imageHeight;
        return {
            id,
            width: width * scaleX,
            height: height * scaleY,
            x: x * scaleX,
            y: y * scaleY,
            body
        }
    }).toArray();

    return translations
}
const parseTranslationContents = (node: Node): TranslationText => {
    if (node.nodeType === node.TEXT_NODE) {
        return (node as Text).data;
    } else {
        const htmlNode = node as HTMLElement;

        let color = "currentcolor";
        if (htmlNode.style.color !== "") {
            color = htmlNode.style.color;
        } else if (htmlNode.nodeName === "FONT") {
            const colorAttribute = htmlNode.attributes.getNamedItem("color")?.value;
            if (colorAttribute !== undefined) color = colorAttribute;
        }

        let fontSize = "1em";
        if (htmlNode.style.fontSize !== "") {
            fontSize = htmlNode.style.fontSize;
        } else if (htmlNode.nodeName === "FONT") {
            const sizeAttribute = htmlNode.attributes.getNamedItem("size")?.value;
            if (sizeAttribute !== undefined) {
                if (sizeAttribute.startsWith("+")) {
                    fontSize = `${(Number(sizeAttribute.slice(1)) * 0.25) + 1}em`;
                } else if (sizeAttribute.startsWith("-")) {
                    fontSize = `${1 - (Number(sizeAttribute.slice(1)) * 0.25)}em`;
                } else {
                    fontSize = `${(Number(sizeAttribute) * 0.25) + 0.25}rem`;
                }
            };
        } else if (htmlNode.nodeName === "TN") {
            fontSize = "0.75rem";
        } else if (htmlNode.nodeName === "BIG") {
            fontSize = "1.25em";
        } else if (htmlNode.nodeName === "SMALL") {
            fontSize = "0.75em";
        }

        const contents = htmlNode.childNodes.values()
            .filter((node) => node.nodeType === node.ELEMENT_NODE || node.nodeType === node.TEXT_NODE)
            .map(parseTranslationContents).toArray();

        if (htmlNode.nodeName === "A") {
            return {
                type: "anchor",
                href: htmlNode.attributes.getNamedItem("href")?.value ?? "",
                color,
                fontSize,
                contents
            }
        } else {
            return {
                type: htmlNode.nodeName === "P" || htmlNode.nodeName === "TN" ? "paragraph" :
                    htmlNode.nodeName === "DIV" ? "line" :
                        "inline",
                color,
                fontSize,
                contents
            }
        }
    }
}

export type AutocompleteTag = {
    type: "tag",
    label: string,
    value: string,
    post_count: string,
    category: string
}
export const suggestTagsFor = async (fetch: typeof globalThis.fetch, like: string): Promise<AutocompleteTag[]> => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=autocomplete2&type=tag_query&limit=10");
    requestUrl.searchParams.set("term", like);
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    return await response.json();
}

export const getTagDescription = async (fetch: typeof globalThis.fetch, tagName: string): Promise<string | undefined> => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=wiki&s=list");
    requestUrl.searchParams.set("search", tagName);
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    let wikiArrayBuffer;

    const responseUrl = new URL(response.url.replace("s=&", ""));
    if (responseUrl.searchParams.get("s") !== "view") {
        const { window: { document } } = new JSDOM(await response.arrayBuffer(), {
            url: response.url,
        });
        const link = document.querySelectorAll<HTMLAnchorElement>("table>tbody>tr>td>a").item(1);

        if (link === null || link.textContent !== tagName) {
            return undefined;
        }

        const postingResponse = await fetch(link.href);
        if (!postingResponse.ok) {
            error(502);
        }

        wikiArrayBuffer = await postingResponse.arrayBuffer();
    } else {
        wikiArrayBuffer = await response.arrayBuffer();
    }

    const { window: { document } } = new JSDOM(wikiArrayBuffer, {
        url: response.url,
    });
    const body = document.querySelector("table>tbody>tr>td");
    if (body === null) {
        error(502);
    }

    let description = "";
    let contentStarted = false
    let addNewline = false;
    for (const node of body?.childNodes) {
        if (!contentStarted && node.nodeName === "SPAN") {
            contentStarted = true;

            continue
        }
        if (!contentStarted) {
            continue;
        }

        if (node.textContent === "See also" || node.textContent === "See also:" || node.textContent === "Other Wiki Information" || node.textContent === "Other actions" || node.textContent === "Related tags") {
            break;
        }
        if (node.nodeType === document.TEXT_NODE || node.nodeName === "B" || node.nodeName === "A") {
            if (addNewline) {
                description = description + '\n';
                addNewline = false;
            }
            description = description + node.textContent;
        } else if (node.nodeName === "BR") {
            addNewline = true;
        } else {
            break;
        }
    }

    return description.trim();
}

export const tryLogin = async (fetch: typeof globalThis.fetch, username: string, password: string) => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=account&s=login&code=00");
    const formData = new FormData();
    formData.append("user", username);
    formData.append("pass", password);
    formData.append("submit", "Log in");
    let response = await fetch(requestUrl, {
        method: "POST",
        redirect: "manual",
        body: formData
    });
    if (response.status > 399 || response.status < 300) {
        error(502);
    }

    let cookies = setCookies.parse(response.headers.getSetCookie());
    cookies = cookies.filter((cookie) => cookie.name !== "PHPSESSID");
    if (cookies.length === 0) {
        return undefined;
    } else {
        return cookies;
    }
}

export const upvotePost = async (fetch: typeof globalThis.fetch, postId: number) => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=post&s=vote&type=up");
    requestUrl.searchParams.set("id", String(postId));
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    const updatedVoteCount = Number(await response.text());
    if (Number.isNaN(updatedVoteCount)) error(502);

    return updatedVoteCount;
}

export const favoritePost = async (fetch: typeof globalThis.fetch, postId: number) => {
    const requestUrl = new URL(ENDPOINT + "public/addfav.php");
    requestUrl.searchParams.set("id", String(postId));
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    const result = await response.text();
    if (result === "1") {
        return "Duplicate";
    } else if (result === "2") {
        return "Unauthorized";
    } else {
        return "Successful";
    }
}

export const unfavoritePost = async (fetch: typeof globalThis.fetch, postId: number) => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=favorites&s=delete");
    requestUrl.searchParams.set("id", String(postId));
    const response = await fetch(requestUrl, {
        redirect: 'manual'
    });
    if (response.status > 399 || response.status < 300) {
        error(502);
    }
}

export const upvoteComment = async (fetch: typeof globalThis.fetch, commentId: number, postId: number) => {
    const requestUrl = new URL(ENDPOINT + "index.php?page=comment&s=vote&vote=up");
    requestUrl.searchParams.set("id", String(postId));
    requestUrl.searchParams.set("cid", String(commentId));
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }

    const updatedVoteCount = parseInt(await response.text());
    if (Number.isNaN(updatedVoteCount)) error(404);

    return updatedVoteCount;
}

export const flagComment = async (fetch: typeof globalThis.fetch, commentId: number, reason: string) => {
    const requestUrl = new URL(ENDPOINT + "public/report.php?type=comment");
    requestUrl.searchParams.set("rid", String(commentId));
    requestUrl.searchParams.set("reason", reason);
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }
}

export const flagPost = async (fetch: typeof globalThis.fetch, postId: number, reason: string) => {
    const requestUrl = new URL(ENDPOINT + "public/report.php?type=post");
    requestUrl.searchParams.set("rid", String(postId));
    requestUrl.searchParams.set("reason", reason);
    const response = await fetch(requestUrl);
    if (!response.ok) {
        error(502);
    }
}

type Posts = {
    "@attributes": {
        limit: number,
        offset: number,
        count: number
    },
    post: Post[] | undefined
}
export type Post = {
    id: number,
    created_at: string,
    score: number,
    width: number,
    height: number,
    md5: string,
    directory: string,
    image: string,
    rating: "general" | "sensitive" | "questionable" | "explicit",
    source: string | "",
    change: number,
    owner: string,
    creator_id: number,
    parent_id: number,
    sample: number,
    preview_height: number,
    preview_width: number,
    tags: string,
    title: string | "",
    has_notes: boolean,
    has_comments: boolean,
    file_url: string,
    preview_url: string,
    sample_url: string | "",
    sample_height: number,
    sample_width: number,
    status: "active" | string,
    post_locked: 0 | 1,
    has_children: boolean
}

export type Tag = {
    id: number,
    name: string,
    count: string,
    type: number,
    ambiguous: number
}

export type Comment = {
    id: number,
    authorProfilePictureUrl: string,
    authorId: number,
    authorUsername: string,
    dateMs: number,
    content: string,
    hearts: number,
    isFlagged: boolean
}

export type Translation = {
    id: number,
    width: number,
    height: number,
    x: number,
    y: number,
    body: TranslationText[]
}
type TranslationTextStyles = {
    // TODO: Maybe I'll support more in the future but meh.
    color: string,
    fontSize: string,
}
export type TranslationText = string |
    ({
        type: "inline" | "line" | "paragraph",
        contents: TranslationText[]
    } & TranslationTextStyles) |
    ({
        type: "anchor",
        href: string,
        contents: TranslationText[]
    } & TranslationTextStyles);