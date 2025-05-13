<script lang="ts">
    import { getUserProfilePictureUrl } from "$lib/Utils";
    import { Dialog, Pagination } from "bits-ui";
    import type { PageData } from "./$types";
    import Comment from "./Comment.svelte";
    import { goto, replaceState } from "$app/navigation";
    import { page } from "$app/state";
    import DialogOverlay from "$lib/DialogOverlay.svelte";
    import { enhance } from "$app/forms";
    import FormInput from "$lib/FormInput.svelte";
    import PaginationComponent from "$lib/Pagination.svelte";

    let {
        post,
        extra,
        user,
    }: PageData & { extra: NonNullable<PageData["extra"]> } = $props();

    let currentPage = $derived(
        Number(page.url.searchParams.get("comment-page") ?? 0) + 1,
    );
    let commentsData = $derived(
        extra instanceof Promise
            ? extra.then((extra) => {
                  return {
                      comments: extra.comments,
                      maxCommentPage: extra.maxCommentPage,
                  };
              })
            : {
                  comments: extra.comments,
                  maxCommentPage: extra.maxCommentPage,
              },
    );

    // TODO: In most cases we know how many comments will be on the next page.
    // We should have a skeleton loader with that many comments here.
    const updateCommentsData = async (pageNumber: number) => {
        const pageIndex = String(pageNumber - 1);
        const url = `/post/${post.id}?comment-page=${pageIndex}`;

        commentsData = fetch(
            `/post/${post.id}/comments?comment-page=${pageIndex}`,
        ).then(async (response) => {
            if (response.status !== 200) {
                await goto(url, { invalidateAll: true });

                return;
            }

            const result = await response.json();
            currentPage = pageNumber;
            return result;
        });

        replaceState(url, page.state);
    };

    let reportingCommentId: number | undefined = $state(undefined);
    let isReportDialogOpen = $derived(reportingCommentId !== undefined);
    let isReportLoading = $state(false);
    let reportReasonError = $derived(page.form?.reason?.error);

    $effect(() => {
        reportingCommentId;

        reportReasonError = undefined;
    });
</script>

<section class="flex flex-col gap-4 min-h-0">
    <h2 class="sr-only">Comments</h2>
    <a
        href="https://gelbooru.com/index.php?page=post&s=view&id={post.id}"
        target="_blank"
        class="block w-full"
        aria-label="Go to Gelbooru to post a comment"
    >
        <div class="flex gap-4 w-full pointer-events-none" aria-hidden="true">
            <img
                src={getUserProfilePictureUrl(user?.id)}
                alt="You"
                class="size-12 rounded-full object-cover object-center"
            />
            <input
                type="text"
                class="border-2 border-invisibles rounded-full w-full px-4"
                placeholder="Type your comment here..."
            />
        </div>
    </a>

    {#await commentsData}
        <i class="sr-only">Loading</i>
    {:then data}
        {#if data.comments.length !== 0}
            <Dialog.Root bind:open={isReportDialogOpen}>
                <ul
                    class="flex flex-col gap-4 overflow-auto min-h-0 scrollbar-thin gutter-stable snap-y snap-proximity"
                >
                    {#each data.comments as comment}
                        <li class="snap-start">
                            <Comment
                                {comment}
                                isLocked={post.post_locked === 1}
                                setReportingComment={(id) => {
                                    reportingCommentId = id;
                                }}
                            />
                        </li>
                    {/each}
                </ul>
                <Dialog.Portal>
                    <DialogOverlay />
                    <Dialog.Content class="normal-dialog max-w-md">
                        <Dialog.Title class="text-xl -mb-0.5">
                            Reason
                        </Dialog.Title>
                        <Dialog.Description class="text-invisibles  text-sm">
                            Why should this comment be deleted?
                        </Dialog.Description>

                        <form
                            action="?/reportComment"
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
                                        await updateCommentsData(currentPage);
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
                            <input
                                type="text"
                                name="comment ID"
                                value={reportingCommentId}
                                class="hidden"
                            />
                            <div class="flex w-full justify-between pt-4">
                                <small
                                    class="text-invisibles text-sm self-start"
                                >
                                    Need help? See
                                    <a
                                        href="https://gelbooru.com/index.php?page=wiki&s=view&id=207"
                                        class="underline"
                                        target="_blank"
                                    >
                                        howto:comment
                                    </a>
                                </small>
                                <button
                                    class="button bg-artist-tag/75 min-w-20"
                                >
                                    {#if isReportLoading}
                                        <i
                                            class="fa-solid fa-spinner animate-spin size-4"
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
        {/if}
        {#if data.maxCommentPage !== 0}
            <Pagination.Root
                count={data.maxCommentPage * 10 + data.comments.length}
                perPage={10}
                page={currentPage}
                class="py-1"
                onPageChange={updateCommentsData}
            >
                {#snippet children({ pages, range })}
                    <PaginationComponent
                        {pages}
                        {range}
                        urlForPage={(page) =>
                            `/post/${post.id}?comment-page=${page - 1}`}
                        {currentPage}
                    />
                {/snippet}
            </Pagination.Root>
        {/if}
    {/await}
</section>
