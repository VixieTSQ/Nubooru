<script lang="ts">
    import { page } from "$app/state";
</script>

<div class="min-size-full grow flex-center text-center">
    <div>
        <strong class="text-8xl">{page.status}</strong>
        <p class="text-invisibles text-2xl">
            {#if page.error !== null}
                {page.error.message}
            {/if}
        </p>
    </div>
</div>
