<script lang="ts">
    import { slide } from "svelte/transition";

    let {
        error,
        class: classNames = "",
    }: { error: string | undefined; class?: string | undefined } = $props();
</script>

{#if error !== undefined}
    <div
        class="text-sm select-none {classNames}"
        transition:slide={{ duration: 150 }}
    >
        <i class="fa-solid fa-circle-exclamation" aria-label="Error:"></i>
        {error}
    </div>
{/if}
