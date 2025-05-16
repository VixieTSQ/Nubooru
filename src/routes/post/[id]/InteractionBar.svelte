<script lang="ts">
    import { enhance } from "$app/forms";
    import HeartButton from "$lib/HeartButton.svelte";
    import MaybePromiseOrDefault from "$lib/MaybePromiseOrDefault.svelte";
    import {
        getUserProfilePictureUrl,
        mapMaybePromise,
        outerMainContainerSelector,
    } from "$lib/Utils";
    import { Dialog, DropdownMenu } from "bits-ui";
    import type { PageServerData } from "./$types";
    import GelbooruLogo from "$lib/assets/gelbooruLogo.svelte";
    import DialogOverlay from "$lib/DialogOverlay.svelte";
    import FormInput from "$lib/FormInput.svelte";
    import { page } from "$app/state";
    import DropdownItem from "./DropdownItem.svelte";

    let {
        post,
        extra,
    }: PageServerData & { extra: NonNullable<PageServerData["extra"]> } =
        $props();

    let isBookmarked = $state(
        mapMaybePromise(extra, (extra) => extra.isFavorited),
    );
    let isHearted: boolean | Promise<boolean> = $state((() => isBookmarked)());
    let hearts = $derived(mapMaybePromise(extra, (extra) => extra.hearts));

    let isReportDialogOpen = $state(false);
    let isReportLoading = $state(false);
    let reportReasonError = $derived(page.form?.reason?.error);

    let bookmarkForm: HTMLFormElement | undefined = $state(undefined);
</script>

<section class="flex items-center justify-between gap-4 px-4 py-3">
    <a class="flex items-center gap-2" href="/?tags=user:{post.owner}">
        <img
            src={getUserProfilePictureUrl(post.creator_id)}
            alt=""
            class="bg-invisibles object-cover object-center rounded-full size-10 bg-fallback-profile-picture"
        />
        <div class="flex flex-col gap-1">
            <div class="leading-none">{post.owner}</div>
            <div class="text-invisibles leading-none text-[0.8rem]">
                <span class="select-none">ID:</span>
                <span class="select-all">{post.creator_id}</span>
            </div>
        </div>
    </a>
    <div class="flex items-center justify-between gap-2 md:gap-3">
        <form
            action="?/heart"
            method="post"
            use:enhance={() => {
                // Optimistic!
                hearts = mapMaybePromise(hearts, (hearts) => hearts + 1);
                isHearted = true;

                return async ({ result, update }) => {
                    if (result.type === "success") {
                        hearts = result.data!.hearts as number;
                    } else {
                        hearts = mapMaybePromise(
                            hearts,
                            (hearts) => hearts - 1,
                        ); // :( our optimism was not rewarded
                        isHearted = false;
                    }

                    await update({
                        invalidateAll: false,
                    });
                };
            }}
        >
            <MaybePromiseOrDefault data={isHearted} defaultData={false}>
                {#snippet children(isHearted)}
                    <HeartButton
                        type="submit"
                        class="leading-0 text-nowrap flex-center gap-2 p-2 px-3 min-w-8 bg-invisibles/50 rounded-full"
                        requiresLogin
                        disabled={isHearted}
                        {isHearted}
                    >
                        {#await hearts}
                            <span
                                class="inline-block h-3 w-5 bg-invisibles/75 animate-pulse rounded-md"
                                aria-label="Loading count"
                            ></span>
                        {:then hearts}
                            <span class="sr-only">Currently:</span>

                            <span class="text-[0.925rem]">
                                {hearts}
                            </span>
                        {/await}
                    </HeartButton>
                {/snippet}
            </MaybePromiseOrDefault>
        </form>
        <MaybePromiseOrDefault data={isBookmarked} defaultData={false}>
            {#snippet children(isBookmarkedOrDefault)}
                <form
                    action={isBookmarkedOrDefault
                        ? "?/unfavorite"
                        : "?/favorite"}
                    method="post"
                    class="hidden md:block"
                    bind:this={bookmarkForm}
                    use:enhance={() => {
                        const original = $state.snapshot(isBookmarkedOrDefault);

                        isBookmarked = !original;
                        if (isBookmarked) {
                            isHearted = true;
                        }

                        return async ({ result, update }) => {
                            if (result.type === "success") {
                                if (!original) {
                                    hearts = result.data!.hearts as number;
                                }
                            } else {
                                isBookmarked = original;
                            }

                            await update({
                                invalidateAll: false,
                            });
                        };
                    }}
                >
                    <button
                        type="submit"
                        class="leading-0 text-nowrap gap-2 p-2 px-3 min-w-8 bg-invisibles/50 rounded-full flex-center group"
                    >
                        {#if isBookmarkedOrDefault}
                            <i
                                class="fa-solid fa-bookmark text-copyright-tag"
                                aria-label="Already bookmarked"
                            ></i>
                        {:else}
                            <i
                                class="fa-regular fa-bookmark group-active:scale-92 transition-transform"
                                aria-label="Click to bookmark"
                            ></i>
                        {/if}
                        <span
                            class="text-[0.925rem] leading-0"
                            aria-hidden="true"
                        >
                            Bookmark
                        </span>
                    </button>
                </form>
            {/snippet}
        </MaybePromiseOrDefault>
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                class="p-2 px-2.5 min-w-8 bg-invisibles/50 rounded-full flex-center"
            >
                <i
                    class="fa-solid fa-ellipsis-vertical leading-0"
                    aria-hidden="true"
                ></i>
                <i class="sr-only">More options</i>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal to={outerMainContainerSelector}>
                <DropdownMenu.Content
                    class="w-48 rounded-2xl bg-neutral-400 shadow-lg/40 py-3 overflow-hidden z-20"
                >
                    <DropdownItem
                        class="md:hidden"
                        onSelect={() => {
                            if (bookmarkForm === undefined) {
                                return;
                            }

                            bookmarkForm.requestSubmit();
                        }}
                    >
                        <span class="inline-block size-5">
                            <div class="flex-center size-full">
                                <MaybePromiseOrDefault
                                    data={isBookmarked}
                                    defaultData={false}
                                >
                                    {#snippet children(isBookmarkedOrDefault)}
                                        {#if isBookmarkedOrDefault}
                                            <i
                                                class="fa-solid fa-bookmark text-lg text-copyright-tag"
                                                aria-label="Already bookmarked"
                                            ></i>
                                        {:else}
                                            <i
                                                class="fa-regular fa-bookmark text-lg"
                                                aria-label="Click to bookmark"
                                            ></i>
                                        {/if}
                                    {/snippet}
                                </MaybePromiseOrDefault>
                            </div>
                        </span>
                        Bookmark
                    </DropdownItem>
                    <DropdownItem
                        onSelect={() => {
                            open(
                                `https://gelbooru.com/index.php?page=post&s=view&id=${post.id}`,
                            );
                        }}
                    >
                        <span class="inline-block size-5">
                            <GelbooruLogo />
                        </span>
                        Open on Gelbooru
                    </DropdownItem>
                    <DropdownItem
                        onSelect={() => {
                            isReportDialogOpen = true;
                        }}
                    >
                        <span class="inline-block size-5">
                            <div class="flex-center size-full">
                                <i class="fa-regular fa-flag text-lg"></i>
                            </div>
                        </span>
                        Report
                    </DropdownItem>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    </div>
</section>
<Dialog.Root bind:open={isReportDialogOpen}>
    <Dialog.Portal>
        <DialogOverlay />
        <Dialog.Content class="normal-dialog max-w-md">
            <Dialog.Title class="text-xl -mb-0.5">Reason</Dialog.Title>
            <Dialog.Description class="text-invisibles  text-sm">
                Why should this post be deleted?
            </Dialog.Description>

            <form
                action="?/reportPost"
                method="post"
                class="pt-4"
                use:enhance={() => {
                    isReportLoading = true;

                    return async ({ update, result }) => {
                        await update({
                            invalidateAll: false,
                        });

                        if (result.type === "success") {
                            isReportDialogOpen = false;
                        }
                        isReportLoading = false;
                    };
                }}
            >
                <FormInput
                    id="reason"
                    placeholder="Enter your explanation here"
                    error={reportReasonError}
                />
                <div class="flex w-full justify-between pt-4">
                    <small class="text-invisibles text-sm self-start">
                        Need help? See
                        <a
                            href="https://gelbooru.com/index.php?page=wiki&s=view&id=6645"
                            class="underline"
                            target="_blank"
                        >
                            howto:upload
                        </a>
                    </small>
                    <button class="button bg-artist-tag/75 min-w-20">
                        {#if isReportLoading}
                            <i class="fa-solid fa-spinner animate-spin size-4"
                            ></i>
                        {:else}
                            Submit
                        {/if}
                    </button>
                </div>
            </form>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
