<script lang="ts">
    import { applyAction, enhance } from "$app/forms";
    import { page } from "$app/state";
    import { Dialog } from "bits-ui";
    import FormInput from "./FormInput.svelte";
    import FormError from "./FormError.svelte";
    import GelbooruLogo from "$lib/assets/gelbooruLogo.svelte";

    let isSigninLoading = $state(false);
    let signinUsernameError = $derived(page.form?.username?.error);
    let signinPasswordError = $derived(page.form?.password?.error);
    let signinError = $derived(page.form?.error);
</script>

<Dialog.Content class="max-w-md normal-dialog">
    <span class="text-center">
        <Dialog.Title class="text-2xl font-bold mb-0.5">Sign in</Dialog.Title>
        <Dialog.Description>
            Sign in to your Gelbooru account
        </Dialog.Description>
    </span>

    <form
        use:enhance={() => {
            isSigninLoading = true;

            return async ({ result, update }) => {
                signinUsernameError = undefined;
                signinPasswordError = undefined;
                signinError = undefined;

                await update();

                if (result.type === "failure") {
                    applyAction(result);
                }

                isSigninLoading = false;
            };
        }}
        action="/?/signin"
        method="POST"
        class="w-full mb-4 mt-4"
    >
        <FormInput
            id="username"
            value={page.form?.username?.value}
            error={signinUsernameError}
            class="w-full mb-4"
            autocomplete="username"
            placeholder="Enter username"
        />
        <FormInput
            id="password"
            type="password"
            error={signinPasswordError}
            class="w-full mb-4"
            autocomplete="current-password"
            placeholder="Enter password"
        />

        <button
            class="block w-full bg-character-tag/75 mt-8 button"
            type="submit"
            disabled={isSigninLoading}
        >
            {#if isSigninLoading}
                <i class="fa-solid fa-spinner animate-spin size-4"></i>
            {:else}
                Sign in
            {/if}
        </button>
        <FormError error={signinError} class="mt-1.5" />
    </form>

    <div class="flex-center">
        <div class="grow border-b-2 border-neutral-700"></div>
        <div class="px-4 font-extrabold">Or</div>
        <div class="grow border-b-2 border-neutral-700"></div>
    </div>

    <a
        href="https://gelbooru.com/index.php?page=account&s=reg"
        target="_blank"
        class="flex-center gap-2 w-full bg-gelbooru-blue/80 mt-4 mb-2 button"
    >
        <div class="h-5" aria-hidden="true"><GelbooruLogo /></div>
        Register on Gelbooru
    </a>
</Dialog.Content>
