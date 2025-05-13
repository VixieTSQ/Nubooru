<script lang="ts">
    import { page } from "$app/state";
    import type { PageProps } from "./$types";
    import PostMasonry from "$lib/PostMasonry.svelte";
    import { tick } from "svelte";
    import { gap, minColumnWidthPx } from "$lib/MasonryManager.svelte";
    import { randomBetween } from "$lib/Utils";
    import { MetaTags } from "svelte-meta-tags";
    import Post from "$lib/Post.svelte";
    import { Pagination } from "bits-ui";
    import PaginationComponent from "$lib/Pagination.svelte";
    import { browser } from "$app/environment";

    let { data }: PageProps = $props();

    let currentPage = $derived(
        Number(page.url.searchParams.get("page") ?? "0") + 1,
    );

    let isMasonryReady = $derived.by(() => {
        data.posts;

        return false;
    });

    let lastIsPostExpanded = false;
    let storedScrollX: number | undefined;
    let storedScrollY: number | undefined;
    let storedUrl: string | undefined;
    $effect(() => {
        const oldExpanded = lastIsPostExpanded;
        lastIsPostExpanded = page.state.expandedPost !== undefined;

        if (!oldExpanded && lastIsPostExpanded) {
            storedScrollX = page.state.expandedPost?.storedScrollX;
            storedScrollY = page.state.expandedPost?.storedScrollY;
            storedUrl = page.state.expandedPost?.from;
        }
        if (oldExpanded && !lastIsPostExpanded) {
            tick().then(() => {
                if (
                    storedScrollX !== undefined &&
                    storedScrollY !== undefined &&
                    storedUrl === page.url.toString()
                ) {
                    window.scroll({
                        behavior: "instant",
                        left: storedScrollX,
                        top: storedScrollY,
                    });
                }

                storedScrollX = undefined;
                storedScrollY = undefined;
                storedUrl = undefined;
            });
        }
    });
</script>

<MetaTags title="Nubooru" />

<div class="pt-4 hide-noscript">
    <div
        class={["w-full", isMasonryReady && "hidden"]}
        style:columns="{minColumnWidthPx}px"
        style:gap="{gap}px"
    >
        {#each { length: 100 }}
            <div
                class="bg-invisibles rounded-lg break-inside-avoid animate-pulse"
                style:height="{randomBetween(200, 400)}px"
                style:margin-bottom="{gap}px"
            ></div>
        {/each}
    </div>
    {#await data.posts then posts}
        <div class={{ invisible: !isMasonryReady }}>
            <h2 class="sr-only">Posts</h2>
            <PostMasonry {posts} bind:isReady={isMasonryReady} />
        </div>
    {/await}
</div>

{#if browser}
    <noscript>
        <div class="pt-4">
            <h2 class="sr-only">Posts</h2>
            {#if !(data.posts instanceof Promise)}
                <ul
                    class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr)))]"
                    style:gap="{gap}px"
                >
                    {#each data.posts as post}
                        <li class="aspect-square flex-center">
                            <Post {post} scaleDown />
                        </li>
                    {/each}
                </ul>
            {/if}
            <Pagination.Root
                count={Math.max(currentPage * 100, 400) + 400}
                perPage={100}
                page={currentPage}
                class="py-1"
            >
                {#snippet children({ pages, range })}
                    <PaginationComponent
                        {pages}
                        {range}
                        urlForPage={(page) => `/?page=${page - 1}`}
                        {currentPage}
                    />
                {/snippet}
            </Pagination.Root>
        </div>

        <style>
            .hide-noscript {
                display: none;
            }
        </style>
    </noscript>
{/if}
