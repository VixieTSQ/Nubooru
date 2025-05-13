<script lang="ts">
    import type { Post, Tag as TagType } from "$lib/gelbooru";
    import { randomBetween, sortTags } from "$lib/Utils";
    import Tag from "./Tag.svelte";

    let { post, tags }: { post: Post; tags: Promise<TagType[]> | TagType[] } =
        $props();
</script>

{#await tags}
    <div aria-hidden="true">
        {#each { length: (post.tags.match(/\s/g) || []).length + 1 }}
            <div
                class="h-3 rounded-md bg-invisibles/75 mb-3 animate-pulse"
                style:width="{randomBetween(180, 60)}px"
            ></div>
        {/each}
    </div>
{:then tags}
    {@const sortedTags = sortTags(tags)}

    <ul
        class="snap-y snap-proximity flex flex-wrap gap-2.5 justify-center md:block"
    >
        {#each sortedTags as tag}
            <li class="snap-start scroll-my-2">
                <Tag {tag} />
            </li>
        {/each}
    </ul>
{/await}
