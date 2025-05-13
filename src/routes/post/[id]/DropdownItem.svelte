<script lang="ts">
    import { DropdownMenu } from "bits-ui";
    import type { Snippet } from "svelte";

    let {
        children,
        onSelect,
        class: classNames = "",
    }: {
        children: Snippet;
        onSelect: () => void;
        class?: string;
    } = $props();
</script>

<DropdownMenu.Item
    class="p-3 py-2 flex items-center gap-2 select-none focus-visible:outline-none data-highlighted:bg-invisibles cursor-pointer {classNames}"
    {onSelect}
>
    {@render children()}
</DropdownMenu.Item>
