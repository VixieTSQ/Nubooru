<script lang="ts">
    import { Pagination, type PageItem } from "bits-ui";

    let {
        pages,
        range,
        urlForPage,
        currentPage,
    }: {
        pages: PageItem[];
        range: { start: number; end: number };
        urlForPage: (page: number) => string;
        currentPage: number;
    } = $props();
</script>

<div class="flex-center gap-2 text-sm">
    <Pagination.PrevButton
        class="size-7 rounded-sm flex-center leading-none active:scale-95 transition-transform disabled:active:scale-100 disabled:text-invisibles group"
        id="back"
    >
        <i
            class="fa-solid fa-chevron-left hide-noscript group-disabled:inline!"
            aria-hidden="true"
        ></i>
        <noscript class="size-full group-disabled:hidden">
            <a
                href={urlForPage(currentPage - 1)}
                class="size-full flex-center"
                aria-labelledby="back"
            >
                <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </a>
        </noscript>
    </Pagination.PrevButton>
    {#each pages as page (page.key)}
        {#if page.type === "page"}
            <Pagination.Page
                {page}
                class="select-none size-7 rounded-sm outline-neutral-700 data-selected:bg-neutral-700 data-selected:text-neutral-450 disabled:cursor-not-allowed active:scale-95 data-selected:active:scale-100 transition-transform hover:bg-invisibles/20 leading-0 flex-center group"
            >
                <span class="hide-noscript group-disabled:inline!"
                    >{page.value}</span
                >

                <noscript class="size-full group-disabled:hidden">
                    <a
                        href={urlForPage(page.value)}
                        class="size-full flex-center"
                    >
                        <span>{page.value}</span>
                    </a>
                </noscript>
            </Pagination.Page>
        {:else}
            <div
                class="select-none text-xs text-invisibles h-7 pb-1 flex items-end justify-center"
            >
                ...
            </div>
        {/if}
    {/each}
    <Pagination.NextButton
        class="size-7 rounded-sm flex-center leading-none active:scale-95 transition-transform disabled:active:scale-100 disabled:text-invisibles group"
    >
        <i
            class="fa-solid fa-chevron-right hide-noscript group-disabled:inline!"
            aria-hidden="true"
        ></i>
        <noscript class="size-full group-disabled:hidden">
            <a
                href={urlForPage(currentPage + 1)}
                class="size-full flex-center"
                aria-labelledby="back"
            >
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </a>
        </noscript>
    </Pagination.NextButton>
</div>
<div class="text-center text-xs text-invisibles pt-3">
    Showing {range.start} - {range.end}
</div>

<noscript>
    <style>
        .hide-noscript {
            display: none;
        }
    </style>
</noscript>
