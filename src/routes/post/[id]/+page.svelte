<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { PageProps, PageServerData } from "./$types";
    import {
        assert,
        isUrl,
        outerMainContainerSelector,
        randomBetween,
        videoFileExtensions,
    } from "$lib/Utils";
    import { preloadData, replaceState } from "$app/navigation";
    import TagList from "./TagList.svelte";
    import { AspectRatio, Dialog } from "bits-ui";
    import { browser } from "$app/environment";
    import DialogOverlay from "$lib/DialogOverlay.svelte";
    import Post from "$lib/Post.svelte";
    import InteractionBar from "./InteractionBar.svelte";
    import moment from "moment";
    import Rating from "./Rating.svelte";
    import Comments from "./Comments.svelte";
    import {
        acquireCachedThumbnail,
        getThumbnailCache,
    } from "$lib/ThumbnailCache";
    import he from "he";
    import { sanitizeUrl } from "@braintree/sanitize-url";
    import { MetaTags } from "svelte-meta-tags";
    import { page } from "$app/state";
    import Translation from "./Translation.svelte";

    const thumbnailCache = getThumbnailCache();

    let { data }: PageProps = $props();

    let createdAtDate = $derived.by(() => {
        let date = data.post.created_at;
        date = date.slice(date.indexOf(" ") + 1);
        date = date.slice(0, -10) + date.slice(-4);
        return date;
    });

    type ExtraInfo = NonNullable<PageServerData["extra"]>;
    let extra: ExtraInfo = $derived(
        data.extra === undefined ? new Promise(() => {}) : data.extra,
    );
    $effect(() => {
        if (data.extra === undefined) {
            const id = data.post.id;

            preloadData(`/post/${id}`)
                .then((result) => {
                    assert(result.type === "loaded");

                    const data = result.data as PageServerData;
                    return data.extra!;
                })
                .then((extra) => {
                    if (page.state.expandedPost?.post?.id !== id) {
                        // idk is this is possible but just incase.
                        return;
                    }

                    // TODO: Causes a bug where state like heart and favorite status aren't
                    // kept after mutating then navigating back and forth.
                    replaceState("", {
                        ...page.state,
                        expandedPost: {
                            ...page.state.expandedPost!, // data.extra is undefined
                            extra,
                        },
                    });
                });
        }
    });

    let sampleUrl = $derived(
        data.post.sample_url === "" ? data.post.file_url : data.post.sample_url,
    );
    let imageWidth = $derived(
        data.post.sample_width === 0 ? data.post.width : data.post.sample_width,
    );
    let imageHeight = $derived(
        data.post.sample_height === 0
            ? data.post.height
            : data.post.sample_height,
    );
    let postTitle =
        data.post.title === "" ? "Untitled" : he.decode(data.post.title);
    let isVideo = $derived(
        videoFileExtensions.some((extension) => sampleUrl.endsWith(extension)),
    );

    let sampleImage: HTMLImageElement | undefined = $state();
    $effect(() => {
        sampleUrl;
        tick().then(() => {
            if (sampleImage === undefined || !sampleImage.complete) {
                return;
            }

            sampleImage.classList.add("opacity-100");
            sampleImage.classList.remove("opacity-0");
        });
    });

    onMount(() => {
        window.scrollTo({
            left: 0,
            top: 0,
            behavior: "instant",
        });
    });

    let defaultVolume = browser
        ? Number(localStorage.getItem("defaultVolume") ?? 1)
        : 1;
    let volume = $state(defaultVolume);
    $effect(() => {
        localStorage.setItem("defaultVolume", String(volume));
    });

    let showTranslations = $state(
        browser
            ? (localStorage.getItem("showTranslations") ?? "true") === "true"
            : true,
    );
    $effect(() => {
        localStorage.setItem("showTranslations", String(showTranslations));
    });
</script>

<MetaTags title={postTitle} />

<!-- TODO: Fix layout shift on firefox -->
<div
    class="w-full min-h-full md:px-4 pt-4 flex flex-col md:flex-row gap-6 md:gap-8 -mb-4"
>
    <aside
        class="md:w-60 2.5xl:w-72 w-full flex gap-8 justify-center md:justify-between pb-8 shrink-0 order-last md:order-0"
    >
        <h2 class="sr-only">Tags</h2>
        <div class="max-h-full md:max-w-[16rem]">
            <TagList
                post={data.post}
                tags={extra instanceof Promise
                    ? extra.then((extra) => extra.tags)
                    : extra.tags}
            />
        </div>
        <div class="relative hidden md:block">
            <!-- TODO: This is fixed for stupid reasons that don't exist anymore. So... don't do that -->
            <div class="fixed bottom-4 top-22">
                <div class="border-invisibles border-r-2 mb-4 h-full"></div>
            </div>
        </div>
    </aside>

    <div
        class="flex flex-col 2xl:flex-row gap-4 2xl:gap-8 2xl:h-[calc(100vh_-_6.5rem)] max-w-full grow self-start 2xl:sticky top-22 min-w-0"
    >
        <div
            class="relative 2xl:min-w-xl max-w-3xl 2xl:max-w-none flex flex-col items-center 2xl:block"
        >
            <div class="absolute inset-0 bottom-20 pointer-events-none">
                <div
                    class="z-10 max-h-full relative group/overlay"
                    style:aspect-ratio="{imageWidth} / {imageHeight}"
                >
                    {#await extra then extra}
                        <section class={[!showTranslations && "sr-only"]}>
                            <h2 class="sr-only">Translations</h2>
                            <ul>
                                {#each extra.translations as translation}
                                    <Translation {translation} />
                                {/each}
                            </ul>
                        </section>
                    {/await}
                    <button
                        class={[
                            "translate-y-3 group-hover/overlay:translate-y-0 opacity-0 group-hover/overlay:opacity-100 transition-all absolute z-10 bottom-3 right-3 rounded-full border-2 size-10 flex-center shadow-lg/40 overflow-hidden text-neutral-800 supports-backdrop-filter:backdrop-blur-sm group/button pointer-events-auto",
                            isVideo && "hidden",
                        ]}
                        onclick={() => (showTranslations = !showTranslations)}
                    >
                        <div
                            class="not-supports-backdrop-filter:blur-sm absolute inset-0 -z-10 bg-neutral-500/30 group-active/button:brightness-150"
                        ></div>
                        <span class="sr-only">
                            {#if showTranslations}
                                Hide translations
                            {:else}
                                Show translations
                            {/if}
                        </span>
                        {#if showTranslations}
                            <i class="fa-solid fa-eye" aria-hidden="true"></i>
                        {:else}
                            <i class="fa-solid fa-eye-slash" aria-hidden="true"
                            ></i>
                        {/if}
                    </button>
                    {#if data.post.sample_url !== ""}
                        <Dialog.Root>
                            <Dialog.Trigger
                                class="absolute inset-0 -z-10 pointer-events-auto"
                            >
                                <span class="sr-only">Expand post</span>
                            </Dialog.Trigger>
                            <Dialog.Portal to={outerMainContainerSelector}>
                                <DialogOverlay />
                                <Dialog.Content
                                    onCloseAutoFocus={(event) =>
                                        event.preventDefault()}
                                >
                                    <img
                                        src={data.post.file_url}
                                        alt=""
                                        class="fixed top-1/2 left-1/2 -translate-1/2 z-70 max-w-screen max-h-screen p-4 md:p-8 pointer-events-none"
                                    />
                                </Dialog.Content>
                            </Dialog.Portal>
                        </Dialog.Root>
                    {/if}
                    <div
                        class="h-16 mt-4 2xl:min-w-xl w-full bg-neutral-450 rounded-sm absolute -bottom-20 pointer-events-auto"
                    >
                        <InteractionBar post={data.post} {extra} />
                    </div>
                </div>
            </div>
            <div class="absolute inset-0 bottom-20 -z-10">
                <div
                    class="z-10 max-h-full relative group/overlay"
                    style:aspect-ratio="{imageWidth} / {imageHeight}"
                >
                    <div
                        class="bg-invisibles -z-10 absolute inset-0 rounded-sm overflow-hidden supports-backdrop-filter:after:backdrop-blur-sm supports-backdrop-filter:after:absolute supports-backdrop-filter:after:inset-0 not-supports-backdrop-filter:blur-sm text-transparent"
                        style:aspect-ratio="{imageWidth} / {imageHeight}"
                        aria-hidden="true"
                        use:acquireCachedThumbnail={{
                            postId: data.post.id,
                            cache: thumbnailCache,
                        }}
                    ></div>
                </div>
            </div>
            <!-- TODO: Weird firefox bug sizes this as if we don't have the pb-20 here. Probably not worth a fix -->
            <div class="h-full pb-20 overflow-hidden min-w-0 relative">
                <div
                    class="max-h-full"
                    style:aspect-ratio="{imageWidth} / {imageHeight}"
                >
                    {#if isVideo}
                        {@const src = (() => {
                            sampleUrl;

                            const url = new URL(sampleUrl);
                            const directory1 = url.pathname.slice(8, 10);
                            const directory2 = url.pathname.slice(11, 13);
                            const filename = url.pathname.slice(14);

                            return `/video?domain=${encodeURIComponent(url.hostname)}&directory1=${directory1}&directory2=${directory2}&file=${encodeURIComponent(filename)}`;
                        })()}

                        <video
                            {src}
                            controls
                            loop
                            class="min-w-0 rounded-sm"
                            style:aspect-ratio="{imageWidth} / {imageHeight}"
                            width={imageWidth}
                            height={imageHeight}
                            bind:volume
                        >
                            <track default kind="captions" />
                        </video>
                    {:else}
                        <!-- TODO: This should be w-full on mobile -->
                        <!-- TODO: Image loading sometimes spontaneously fails, as Gelbooru redirects the image URL
                            to the post page for unknown reasons (rate limiting? I know the img url can be different
                            on different post requests for load balancing reasons)
                            But when I reload the page it's perfectly fine, so we should retry this if it it fails.
                            (Forget if I was reloading the page entirely or not, which would mean we're refetching
                            the post, meaning we probably get a *different* url and that's why it works. Hopefully not) -->
                        <img
                            src={sampleUrl}
                            alt=""
                            class={[
                                "transition-opacity duration-200 min-w-0 rounded-sm",
                                browser && "opacity-0",
                            ]}
                            style:aspect-ratio="{imageWidth} / {imageHeight}"
                            width={imageWidth}
                            height={imageHeight}
                            fetchpriority="high"
                            bind:this={sampleImage}
                            onload={(event) => {
                                event.currentTarget.classList.add(
                                    "opacity-100",
                                );
                                event.currentTarget.classList.remove(
                                    "opacity-0",
                                );
                            }}
                        />
                    {/if}
                </div>
            </div>
        </div>

        <div
            class="2xl:basis-xl 2xl:min-w-lg max-w-3xl grow flex flex-col items-stretch gap-4 max-h-full"
        >
            <div
                class="bg-neutral-450 rounded-sm px-4 py-3 min-h-0 flex flex-col"
            >
                <div class="mb-4">
                    <div class="flex flex-col gap-1 mb-2">
                        <div class="flex items-center gap-2">
                            <h2 class="text-2xl inline leading-none">
                                {postTitle}
                            </h2>
                            <Rating rating={data.post.rating} />
                        </div>
                        <span
                            class="first-letter:uppercase text-sm text-nowrap text-invisibles leading-none"
                        >
                            <i class="sr-only">Posted:</i>
                            {moment(new Date(createdAtDate)).fromNow()}
                        </span>
                    </div>
                    <!-- TODO: Isn't there also like post commentary and stuff occasionally on the page? That should be put here. -->
                    {#if isUrl(data.post.source)}
                        <a
                            href={sanitizeUrl(data.post.source)}
                            target="_blank"
                            class="hover:underline break-all"
                        >
                            {data.post.source}
                        </a>
                    {:else}
                        <span class="break-all">{data.post.source}</span>
                    {/if}
                </div>

                <Comments user={data.user} post={data.post} {extra} />
            </div>

            <section class="self-start w-full">
                <h2 class="sr-only">Suggested Posts</h2>
                <ul
                    class="flex items-start gap-4 max-h-48 justify-evenly w-full"
                >
                    {#await extra}
                        <i class="sr-only">Loading</i>
                        {#each { length: 4 }}
                            {@const width = randomBetween(250, 180)}
                            <li
                                class="max-h-full rounded-lg bg-invisibles/75 animate-pulse"
                                aria-hidden="true"
                                style:flex-basis="{width}px"
                                style:aspect-ratio="{width} / {randomBetween(
                                    250,
                                    170,
                                )}"
                            ></li>
                        {/each}
                    {:then extra}
                        {#each extra.suggestedPosts.slice(0, 4) as suggestedPost}
                            <!-- TODO: Prevent layout shift here as these load. I set their flex basis before
                             but that made them overflow sometimes -->
                            <!-- TODO: ACTUALLY STILL OVERFLOWING AA -->
                            <li
                                class="min-w-0 max-h-full"
                                style:aspect-ratio="{suggestedPost.preview_width}
                                / {suggestedPost.preview_height}"
                            >
                                <Post post={suggestedPost} />
                            </li>
                        {/each}
                    {/await}
                </ul>
            </section>
        </div>
    </div>
</div>
