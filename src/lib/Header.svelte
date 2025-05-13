<script lang="ts">
    import type { UIEventHandler } from "svelte/elements";
    import Search from "$lib/search/Search.svelte";
    import { Dialog } from "bits-ui";
    import {
        getUserProfilePictureUrl,
        outerMainContainerSelector,
    } from "./Utils";
    import DialogOverlay from "./DialogOverlay.svelte";
    import { page } from "$app/state";
    import SigninDialog from "./SigninDialog.svelte";
    import { pushState, replaceState } from "$app/navigation";

    let showHeader = $state(true);

    let isSigninOpen = $state(
        page.url.searchParams.get("signin") === "true" ||
            (page.state.showSigninModal ?? false),
    );
    $effect(() => {
        page.state;
        page.url;

        isSigninOpen =
            page.url.searchParams.get("signin") === "true" ||
            (page.state.showSigninModal ?? false);
    });

    let lastScrollPx = 0;
    const onScroll: UIEventHandler<Window> = () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll <= lastScrollPx) {
            showHeader = true;
        } else if (currentScroll >= 72) {
            showHeader = false;
        }

        lastScrollPx = currentScroll;
    };
</script>

<svelte:window onscroll={onScroll} />

<!-- TODO: On mobile, maybe when we open the search, the user icon flies off to the left to make space for the search bar -->
<header
    class="shrink-0 sticky top-0 w-full z-40 transition-transform duration-250 ease-out p-4 shadow-lg/40 bg-neutral-300"
    class:-translate-y-full={!showHeader &&
        !(
            page.url.pathname.startsWith("/post/") ||
            page.state.expandedPost !== undefined
        )}
>
    <div class="flex gap-4 h-10">
        <Dialog.Root
            bind:open={isSigninOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    replaceState("?signin=false", {
                        ...page.state,
                        showSigninModal: false,
                    });
                }
            }}
        >
            <Dialog.Trigger>
                {#snippet child({ props })}
                    <!-- TODO: when noscript, click to sign out -->
                    <a
                        {...props}
                        href="?signin=true"
                        onclick={(event) => {
                            event.preventDefault();
                            pushState("?signin=true", {
                                ...page.state,
                                showSigninModal: true,
                            });
                        }}
                        class:pointer-events-none={page.data.user !== undefined}
                    >
                        <img
                            src={getUserProfilePictureUrl(page.data.user?.id)}
                            alt={page.data.user === undefined
                                ? "Not signed in"
                                : "Profile"}
                            class="rounded-full bg-invisibles overflow-hidden size-10 object-cover object-center bg-fallback-profile-picture"
                        />
                    </a>
                {/snippet}
            </Dialog.Trigger>
            <Dialog.Portal to={outerMainContainerSelector}>
                <DialogOverlay />
                <SigninDialog />
            </Dialog.Portal>
        </Dialog.Root>
        <Search />
    </div>
</header>
