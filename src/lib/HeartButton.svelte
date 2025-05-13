<script lang="ts">
    import type { HTMLButtonAttributes } from "svelte/elements";
    import { fade, scale } from "svelte/transition";
    import { reallyBackOut } from "./Utils";
    import type { Snippet } from "svelte";
    import { page } from "$app/state";
    import { pushState } from "$app/navigation";

    let {
        isHearted,
        requiresLogin = false,
        children,
        ...restProps
    }: {
        isHearted: boolean;
        requiresLogin?: boolean;
        children?: Snippet;
    } & HTMLButtonAttributes = $props();
</script>

{#snippet icon()}
    {#if isHearted}
        <i
            class="fa-solid fa-heart text-artist-tag col-start-1 row-start-1 z-10 scale-102"
            aria-label="Already hearted"
            in:scale={{
                duration: 225,
                easing: reallyBackOut,
                opacity: 0,
            }}
        ></i>
    {:else}
        <i
            class="fa-regular fa-heart col-start-1 row-start-1 group-active:scale-92 transition-transform"
            aria-label="Click to heart"
            aria-hidden={isHearted}
            out:fade={{ delay: 100, duration: 100 }}
        ></i>
    {/if}
{/snippet}

{#if requiresLogin && page.data.user === undefined}
    <a
        href="?signin=true"
        class="group {restProps.class}"
        onclick={(event) => {
            event.preventDefault();
            pushState("?signin=true", {
                ...page.state,
                showSigninModal: true,
            });
        }}
    >
        {@render icon()}
        {@render children?.()}
    </a>
{:else}
    <button {...restProps} class="group {restProps.class}">
        <span class="inline-block">
            <div class="relative grid grid-cols-1 grid-rows-1">
                {@render icon()}
            </div>
        </span>

        {@render children?.()}
    </button>
{/if}
