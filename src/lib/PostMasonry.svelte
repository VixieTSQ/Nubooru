<script lang="ts">
    import type { Post as PostType } from "$lib/gelbooru";
    import Post from "$lib/Post.svelte";
    import { tick, untrack } from "svelte";
    import MasonryManager, { type Brick } from "./MasonryManager.svelte";
    import type { ActionReturn } from "svelte/action";
    import { page } from "$app/state";
    import { isPost } from "./Utils";

    let {
        posts: postsList,
        isReady = $bindable(false),
    }: { posts: PostType[]; isReady: boolean } = $props();

    let masonryWidth: number | undefined = $state(undefined);
    let pageLastBrickQueue: Brick<PostType>[] = $state([]);
    let manager: MasonryManager<PostType> = $derived.by(() => {
        postsList;

        let needWidth = false;
        const newManager = new MasonryManager<PostType>();
        untrack(() => {
            isReady = false;
            pageLastBrickQueue = [];

            if (masonryWidth !== undefined) {
                (async () => {
                    newManager.addItems(postsList, masonryWidth);
                    updatePageLastBrickQueue(newManager.bricks);
                })()
                    .then(tick)
                    // TODO: maybe wait for image load if they're in the viewport? With a max wait?
                    .then(() => (isReady = true));
            } else {
                needWidth = true;
            }
        });
        if (needWidth) {
            masonryWidth;
        }

        return newManager;
    });

    let masonryHeight = $derived(
        manager.bricks.reduce(
            (maxBottom, brick) => Math.max(brick.bottom, maxBottom),
            0,
        ),
    );
    let widthUpdateTimeout: NodeJS.Timeout | undefined = undefined;
    $effect(() => {
        masonryWidth;

        if (masonryWidth !== undefined && masonryWidth !== 0) {
            const nowMasonryWidth = $state.snapshot(masonryWidth);

            clearTimeout(widthUpdateTimeout);
            widthUpdateTimeout = setTimeout(() => {
                manager.onWidthChange(nowMasonryWidth);
            }, 200);
        }
    });

    let isAtEnd: boolean = $derived(!postsList);
    let pageIndex = 0;
    let isLoading = $state(false);
    const fetchNextPage = async () => {
        if (masonryWidth === undefined || isAtEnd || isLoading) {
            return;
        }

        isLoading = true;
        pageIndex += 1;

        const requestUrl = new URL("/posts", page.url);
        requestUrl.searchParams.set(
            "tags",
            page.url.searchParams.get("tags") ?? "",
        );
        requestUrl.searchParams.set("page", String(pageIndex));
        await fetch(requestUrl)
            .then(async (response) => {
                if (!response.ok) {
                    isAtEnd = true;

                    throw new Error(JSON.stringify(response));
                }

                const newPosts: PostType[] = await response.json();
                if (newPosts.length === 0) {
                    isAtEnd = true;

                    return;
                }

                manager.addItems(newPosts, masonryWidth!);
                updatePageLastBrickQueue(manager.bricks);
            })
            .finally(() => {
                isLoading = false;
            });
    };
    const loadOnScrollPast = (node: HTMLElement): ActionReturn<undefined> => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].intersectionRatio <= 0) {
                return;
            }

            fetchNextPage();
        });
        observer.observe(node);

        return {
            destroy: () => {
                observer.disconnect();
            },
        };
    };

    let disableTranslationAnimation = $state(false);
    const updatePageLastBrickQueue = (bricks: Brick<PostType>[]) => {
        if (bricks.length === 0) {
            pageLastBrickQueue = [];

            return;
        }

        const lastBrick = bricks[bricks.length - 1];
        if (
            pageLastBrickQueue.length === 0 ||
            lastBrick !== pageLastBrickQueue[pageLastBrickQueue.length - 1]
        ) {
            pageLastBrickQueue.push(lastBrick);
        }
    };
    const numberOfViewportsScrolledFromPageUntilUnload = 4;
    type UnloadOnScrollFarOpts = {
        brick: Brick<PostType>;
        brickQueue: Brick<PostType>[];
    };
    const unloadOnScrollFar = (
        node: HTMLElement,
        opts: UnloadOnScrollFarOpts,
    ): ActionReturn<UnloadOnScrollFarOpts> => {
        const { brick, brickQueue } = opts;

        let lastTop = brick.top;
        let observer: IntersectionObserver | undefined = undefined;

        if (brickQueue[0] === brick) {
            observer = unloadOnScrollFarInner(node, brick);
        }

        return {
            destroy: () => {
                observer?.disconnect();
            },
            update: async (opts) => {
                const { brick, brickQueue } = opts;

                if (observer === undefined && brickQueue[0] === brick) {
                    observer = unloadOnScrollFarInner(node, brick);
                } else if (observer !== undefined && lastTop !== brick.top) {
                    observer.disconnect();
                    observer = unloadOnScrollFarInner(node, brick);
                }

                lastTop = brick.top;
            },
        };
    };
    const unloadOnScrollFarInner = (
        node: HTMLElement,
        brick: Brick<PostType>,
    ) => {
        const yThreshold =
            window.innerHeight * numberOfViewportsScrolledFromPageUntilUnload +
            brick.top;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].intersectionRatio <= 0) {
                    return;
                }

                disableTranslationAnimation = true;
                tick().then(() => {
                    const pageEndIndex = manager.bricks.findIndex(
                        (searchBrick) => searchBrick === brick,
                    );
                    manager.removeItems(pageEndIndex + 1, masonryWidth!);
                    pageLastBrickQueue = pageLastBrickQueue.filter(
                        (searchBrick) => searchBrick !== brick,
                    );
                    setTimeout(() => {
                        disableTranslationAnimation = false;
                    }, 500);
                });
            },
            {
                rootMargin: `${yThreshold}px 0px -${yThreshold}px 0px`,
                threshold: 0,
            },
        );

        observer.observe(node);

        return observer;
    };
</script>

<ul
    class="w-full relative overflow-hidden grid grid-cols-1 grid-rows-1 place-items-start"
    bind:clientWidth={
        null, (width) => (masonryWidth = Number.isFinite(width) ? width : 0)
    }
    style:height="{masonryHeight}px"
>
    {#each manager.bricks as brick (brick.item.id)}
        <li
            class={[
                "block post col-start-1 col-end-1 row-start-1 row-end-1",
                !disableTranslationAnimation &&
                    "motion-safe:transition-transform duration-300",
            ]}
            style:--left="{brick.left}px"
            style:--top="{brick.top}px"
            style:width="{brick.right - brick.left}px"
            style:height="{brick.bottom - brick.top}px"
            use:unloadOnScrollFar={{
                brick,
                brickQueue: pageLastBrickQueue,
            }}
        >
            {#if isPost(brick.item)}
                <Post post={brick.item} />
            {:else}
                <div
                    aria-hidden="true"
                    class="size-full rounded-lg bg-invisibles"
                ></div>
            {/if}
        </li>
    {/each}
</ul>

<div class="w-full h-32 flex-center text-lg">
    {#if postsList !== undefined}
        {#if postsList.length === 0}
            <span>No results</span>
        {:else if isAtEnd}
            <span>End of the road</span>
        {:else}
            <i
                class="fa-solid fa-spinner animate-spin size-4"
                aria-hidden="true"
                use:loadOnScrollPast
            ></i>
            {#if isLoading}
                <i class="sr-only">Loading</i>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .post {
        transform: translate(
            var(--left, 0px),
            calc(var(--top, 0px) + var(--top-offset, 0px))
        );
    }
    @supports (transform: translate3d(0, 0, 0)) {
        .post {
            transform: translate3d(
                var(--left, 0px),
                calc(var(--top, 0px) + var(--top-offset, 0px)),
                0
            );
        }
    }

    @media (prefers-reduced-motion: no-preference) {
        @supports (background: paint(propjockey)) or
            (
                (width: 1rlh) and
                    ((-webkit-hyphens: none) or (-moz-appearance: none))
            ) {
            @property --top-offset {
                syntax: "<length>";
                inherits: true;
                initial-value: 0px;
            }

            @keyframes spring-up {
                0% {
                    --top-offset: 40px;
                    opacity: 0.75;
                }
                100% {
                    --top-offset: 0px;
                    opacity: 1;
                }
            }

            /* TODO: Bit of a jump here when we resize the width, probably not fixable */
            .post {
                animation: 1ms spring-up both;
                animation-timeline: scroll(root);
                animation-range: contain calc(var(--top, 0px) - 100vh + 100px)
                    contain calc(var(--top, 0px) - 100vh + 275px);
                opacity: 0.75;
            }
        }
    }
</style>
