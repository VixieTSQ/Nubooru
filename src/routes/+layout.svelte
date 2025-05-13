<script lang="ts">
    import "../app.css";
    import "@fortawesome/fontawesome-free/css/all.min.css";
    import {
        getUpscaler,
        setUpscaler,
        UpscalerQueue,
    } from "$lib/upscaling/UpscalerQueue";
    import Header from "$lib/Header.svelte";
    import { innerMainContainerId, outerMainContainerId } from "$lib/Utils";
    import { page } from "$app/state";
    import PostPage from "./post/[id]/+page.svelte";
    import type { LayoutProps } from "./$types";
    import ThumbnailCache, { setThumbnailCache } from "$lib/ThumbnailCache";

    let thumbnailCache = $state(new ThumbnailCache());
    setThumbnailCache(thumbnailCache);

    if (getUpscaler() === undefined) {
        setUpscaler(new UpscalerQueue());
    }

    let { children, data }: LayoutProps = $props();
</script>

<div class="w-full grow flex flex-col" id={outerMainContainerId}>
    <Header />
    <main
        class="w-full grow p-4 pt-0 flex flex-col relative"
        id={innerMainContainerId}
    >
        <div
            class="contents"
            class:hidden={page.state.expandedPost !== undefined}
        >
            {@render children()}
        </div>

        {#if page.state.expandedPost !== undefined}
            {#key page.state.expandedPost.post.id}
                <PostPage
                    data={{
                        ...data,
                        post: page.state.expandedPost.post,
                        extra: page.state.expandedPost.extra,
                    }}
                    form={page.form}
                />
            {/key}
        {/if}
    </main>
</div>
