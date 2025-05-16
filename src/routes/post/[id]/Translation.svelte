<script lang="ts">
    import type { Translation, TranslationText } from "$lib/gelbooru";
    import { sanitizeUrl } from "@braintree/sanitize-url";

    let { translation }: { translation: Translation } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<li
    class="absolute bg-invisibles/85 rounded-lg border-2 border-invisibles/90 shadow-md/25 flex justify-end items-end p-0.5 group"
    tabindex="0"
    style:top="{translation.y}%"
    style:left="{translation.x}%"
    style:right="{100 - (translation.x + translation.width)}%"
    style:bottom="{100 - (translation.y + translation.height)}%"
>
    <i
        class="fa-solid fa-caret-down text-neutral-500/50 -rotate-50 translate-y-0.75"
        aria-hidden="true"
    ></i>
    <div
        class="not-group-hover:not-group-focus-within:sr-only absolute top-full left-0 translate-y-2 w-3xs rounded-lg overflow-hidden p-3 shadow-md/25 border border-invisibles z-20"
    >
        <div
            class="supports-backdrop-filter:backdrop-blur-sm not-supports-backdrop-filter:blur-sm absolute inset-0 -z-10 bg-neutral-500/70"
        ></div>
        <div>
            {@render translationText({
                type: "line",
                color: "currentcolor",
                fontSize: "1em",
                contents: translation.body,
            })}
        </div>
    </div>
</li>

{#snippet translationText(text: TranslationText)}
    {#if typeof text === "string"}
        {@const lines = text.split("\n")}
        {#each lines as line, index}
            {line}
            {#if index + 1 !== lines.length}
                <br />
            {/if}
        {/each}
    {:else if text.type === "inline"}
        <span style:color={text.color} style:font-size={text.fontSize}>
            {#each text.contents as child}
                {@render translationText(child)}
            {/each}
        </span>
    {:else if text.type === "line"}
        <div style:color={text.color} style:font-size={text.fontSize}>
            {#each text.contents as child}
                {@render translationText(child)}
            {/each}
        </div>
    {:else if text.type === "paragraph"}
        <p style:color={text.color} style:font-size={text.fontSize}>
            {#each text.contents as child}
                {@render translationText(child)}
            {/each}
        </p>
    {:else if text.type === "anchor"}
        <a
            href={sanitizeUrl(text.href)}
            target="_blank"
            class="underline"
            style:color={text.color}
            style:font-size={text.fontSize}
        >
            {#each text.contents as child}
                {@render translationText(child)}
            {/each}
        </a>
    {/if}
{/snippet}
