<script lang="ts">
    import type { Post } from "$lib/gelbooru";

    let { rating }: { rating: Post["rating"] } = $props();
</script>

<span
    class="inline-block first-letter:uppercase font-bold text-sm text-nowrap px-2 py-0.5 rounded-full border"
    class:bg-general-500={rating === "general"}
    class:text-general-300={rating === "general"}
    class:border-general-300={rating === "general"}
    class:bg-sensitive-500={rating === "sensitive"}
    class:text-sensitive-300={rating === "sensitive"}
    class:border-sensitive-300={rating === "sensitive"}
    class:bg-questionable-500={rating === "questionable"}
    class:text-questionable-300={rating === "questionable"}
    class:border-questionable-300={rating === "questionable"}
    class:bg-explicit-500={rating === "explicit"}
    class:text-explicit-300={rating === "explicit"}
    class:border-explicit-300={rating === "explicit"}
>
    <i class="sr-only">rating:</i>
    {rating}
</span>
