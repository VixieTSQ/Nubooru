<script lang="ts">
    import { pushState } from "$app/navigation";
    import { page } from "$app/state";
    import { animatedFileExtensions } from "./Utils";
    import { onDestroy } from "svelte";
    import { getUpscaler } from "$lib/upscaling/UpscalerQueue";
    import type { Post } from "$lib/gelbooru";
    import type { EventHandler } from "svelte/elements";
    import { cacheThumbnail, getThumbnailCache } from "./ThumbnailCache";
    import he from "he";

    const thumbnailCache = getThumbnailCache();
    const upscaler = getUpscaler();

    let { post, scaleDown = false }: { post: Post; scaleDown?: boolean } =
        $props();

    const onClick = (event: MouseEvent) => {
        if (
            event.shiftKey ||
            event.metaKey ||
            event.ctrlKey ||
            event.button != 0
        )
            return;
        event.preventDefault();
        event.stopPropagation();

        pushState(`/post/${post.id}`, {
            ...page.state,
            expandedPost: {
                post: $state.snapshot(post),
                extra: undefined,
                storedScrollX: window.scrollX,
                storedScrollY: window.scrollY,
                from: page.url.toString(),
            },
        });
    };

    let src = $derived.by(() => {
        post.preview_url;

        const url = new URL(post.preview_url);
        const directory1 = url.pathname.slice(12, 14);
        const directory2 = url.pathname.slice(15, 17);
        const filename = url.pathname.slice(18);

        return `/thumbnail?domain=${encodeURIComponent(url.hostname)}&directory1=${directory1}&directory2=${directory2}&file=${encodeURIComponent(filename)}`;
    });

    let abortUpscale: AbortController | undefined = undefined;
    const onLoad: EventHandler<Event, HTMLImageElement> = (event) => {
        if (abortUpscale !== undefined) {
            return;
        }

        if (event.currentTarget.width / post.preview_width < 1.3) {
            return;
        }

        abortUpscale = new AbortController();
        upscaler
            .execute(event.currentTarget, abortUpscale.signal)
            .then((upscaledSrc) => {
                src = upscaledSrc;
            });
    };

    onDestroy(() => {
        if (abortUpscale != undefined) {
            abortUpscale.abort();
        }
    });
</script>

<a
    data-sveltekit-preload-data="false"
    href={"/post/" + post.id}
    onclick={onClick}
    class={[
        "rounded-lg overflow-hidden flex-center before:absolute before:inset-0 before:rounded-lg before:-z-10 relative",
        !scaleDown && "before:bg-invisibles/75",
        !scaleDown &&
            post.preview_height >= post.preview_width &&
            "h-full max-w-full",
        !scaleDown &&
            post.preview_height <= post.preview_width &&
            "w-full max-h-full",
    ]}
>
    <i class="sr-only">
        {post.title === ""
            ? "Untitled post"
            : `Post titled: ${he.decode(post.title)}`}
    </i>
    {#if animatedFileExtensions.some( (extension) => post.file_url.endsWith(extension), )}
        <div
            class="absolute inset-0 inset-ring-4 rounded-lg inset-ring-blue-accent"
        ></div>
    {/if}

    <img
        {src}
        alt=""
        class={[!scaleDown && "object-cover size-full"]}
        width={post.preview_width}
        height={post.preview_height}
        onload={onLoad as any}
        use:cacheThumbnail={{ postId: post.id, cache: thumbnailCache }}
    />
</a>
