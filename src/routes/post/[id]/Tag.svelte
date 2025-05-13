<script lang="ts">
    import { LinkPreview, Portal } from "bits-ui";
    import type { Tag } from "$lib/gelbooru";
    import { getTagTypeFromTypeId } from "$lib/Utils";

    let { tag }: { tag: Tag } = $props();

    let type = $derived(getTagTypeFromTypeId(tag.type));

    let isDescriptionOpen = $state(false);
    let isNoDescriptionAvailable = $state(false);
    let isLoadingDescription = false;
    let description: string | undefined = $state(undefined);

    const truncateText = (text: string) => {
        if (text.length > 100) {
            return text.substring(0, 100) + "...";
        }

        return text;
    };
</script>

<div class="relative">
    <LinkPreview.Root
        bind:open={isDescriptionOpen}
        onOpenChange={(isOpen) => {
            if (isNoDescriptionAvailable) {
                isDescriptionOpen = false;

                return;
            }

            if (!isOpen || description !== undefined || isLoadingDescription) {
                return;
            }
            isLoadingDescription = true;

            fetch(`/tag/description?name=${tag.name}`, { method: "GET" }).then(
                async (response) => {
                    if (!response.ok) {
                        isDescriptionOpen = false;
                        isNoDescriptionAvailable = true;
                        isLoadingDescription = false;

                        return;
                    }

                    description = await response.json();
                    isLoadingDescription = false;
                },
            );
        }}
    >
        <LinkPreview.Trigger>
            {#snippet child({ props })}
                <a
                    {...props}
                    href="/?tags={tag.name}"
                    class="hover:underline peer break-all"
                    class:text-metadata-tag={type === "metadata"}
                    class:text-artist-tag={type === "artist"}
                    class:text-copyright-tag={type === "copyright"}
                    class:text-character-tag={type === "character"}
                    class:text-deprecated-tag={type === "deprecated"}
                    class:line-through={type === "deprecated"}
                >
                    {tag.name}
                    <span
                        class="text-invisibles font-normal tracking-tight break-normal hidden md:inline"
                    >
                        {tag.count}
                    </span>
                </a>
            {/snippet}
        </LinkPreview.Trigger>
        <Portal>
            <LinkPreview.Content
                collisionPadding={8}
                align="center"
                side="bottom"
                sideOffset={8}
                class="z-60"
            >
                <LinkPreview.Arrow class="text-neutral-400" height={10} />
                <div
                    class="bg-neutral-400 p-3 rounded w-72"
                    class:text-center={description === undefined}
                >
                    <h3 class="sr-only">Tag Description</h3>
                    {#if description === undefined}
                        <i
                            class="fa-solid fa-spinner animate-spin"
                            aria-hidden="true"
                        ></i>
                        <i class="sr-only">Loading</i>
                    {:else}
                        {@const truncatedText = truncateText(description)}
                        {#each truncatedText.split("\n") as line}
                            <p>{line}</p>
                        {/each}
                    {/if}
                </div>
            </LinkPreview.Content>
        </Portal>
    </LinkPreview.Root>
</div>
