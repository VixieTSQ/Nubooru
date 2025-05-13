<script lang="ts" generics="T">
    import type { Snippet } from "svelte";

    let {
        data,
        defaultData,
        children,
    }: {
        data: T | Promise<T>;
        defaultData: T;
        children: Snippet<[T]>;
    } = $props();

    let finalData = $derived.by(() => {
        if (data instanceof Promise) {
            return defaultData;
        } else {
            return data;
        }
    });

    $effect(() => {
        if (data instanceof Promise) {
            const dataSnapshot = data;
            dataSnapshot.then((resolvedData) => {
                if (data === dataSnapshot) {
                    finalData = resolvedData;
                }
            });
        }
    });
</script>

{@render children(finalData)}
