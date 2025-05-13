<script lang="ts">
    import { enhance } from "$app/forms";
    import type { Comment } from "$lib/gelbooru";
    import HeartButton from "$lib/HeartButton.svelte";
    import { Dialog } from "bits-ui";
    import moment from "moment";

    let {
        comment,
        isLocked,
        setReportingComment,
    }: {
        comment: Comment;
        isLocked: boolean;
        setReportingComment: (id: number) => void;
    } = $props();

    let isHearted = $state(false);
    let hearts = $derived(comment.hearts);

    const fromUserSearchUrl = `/?tags=user:${comment.authorUsername}`;
</script>

<article class="flex gap-4 w-full items-start p-2 rounded-sm">
    <a href={fromUserSearchUrl} class="block shrink-0">
        <img
            src={comment.authorProfilePictureUrl}
            alt=""
            class="size-10 md:size-12 rounded-full object-cover object-center"
        />
    </a>
    <div>
        <div>
            <a href={fromUserSearchUrl}>
                {comment.authorUsername}
            </a>
            <span class="text-invisibles text-sm">
                {moment(comment.dateMs).fromNow()}
            </span>
        </div>
        <div>
            {#each comment.content.split("\n") as paragraph}
                {#if paragraph === ""}
                    <br />
                {:else}
                    <p>{paragraph}</p>
                {/if}
            {/each}
            <div class="flex gap-4 items-center text-sm mt-2">
                <span>
                    <form
                        action="?/heartComment"
                        method="post"
                        use:enhance={() => {
                            isHearted = true;
                            hearts = hearts + 1;

                            return async ({ result, update }) => {
                                if (result.type === "success") {
                                    hearts = result.data!.hearts as number;
                                } else {
                                    isHearted = false;
                                    hearts = hearts - 1;
                                    await update();
                                }
                            };
                        }}
                    >
                        <HeartButton
                            type="submit"
                            requiresLogin
                            {isHearted}
                            disabled={isHearted || isLocked}
                        >
                            <span>{hearts}</span>
                        </HeartButton>
                        <input
                            type="text"
                            name="comment ID"
                            value={comment.id}
                            class="hidden"
                        />
                    </form>
                </span>

                <Dialog.Trigger
                    onclick={() => {
                        setReportingComment(comment.id);
                    }}
                    disabled={isHearted || isLocked}
                >
                    {#if comment.isFlagged}
                        <i
                            class="fa-solid fa-flag"
                            aria-label="Already reported"
                        ></i>
                    {:else}
                        <i
                            class="fa-regular fa-flag"
                            aria-label="Click to report"
                        ></i>
                    {/if}
                </Dialog.Trigger>
            </div>
        </div>
    </div>
</article>
