<script lang="ts">
    import { Label } from "bits-ui";
    import FormError from "./FormError.svelte";
    import type {
        HTMLInputAttributes,
        HTMLInputTypeAttribute,
    } from "svelte/elements";

    let {
        id,
        type = "text",
        value,
        label = id,
        error = undefined,
        class: classNames = "",
        autocomplete = "on",
        placeholder = "",
    }: {
        id: string;
        type?: HTMLInputTypeAttribute | undefined;
        value?: string | undefined;
        label?: string;
        error?: string | undefined;
        class?: string | undefined;
        autocomplete?: HTMLInputAttributes["autocomplete"] | undefined;
        placeholder?: string | undefined;
    } = $props();
</script>

<div class={classNames}>
    <Label.Root for={id} class="capitalize">{label}</Label.Root>
    <input
        {type}
        autocorrect="off"
        {autocomplete}
        {placeholder}
        name={id}
        {id}
        class="w-full bg-neutral-450 outline-1 outline-invisibles focus-visible:outline-neutral-700 rounded-xl p-2 px-4 mt-1 transition-colors placeholder:font-normal"
        value={value ?? ""}
    />
    <FormError {error} class="mt-1.5" />
</div>
