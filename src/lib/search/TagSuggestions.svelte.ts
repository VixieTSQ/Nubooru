import type { AutocompleteTag } from "$lib/gelbooru";
import { ContentTagNode, type Node } from "./searchTree";

export type TagSuggestionStatus = "none" | "loading" | AutocompleteTag[];
export default class TagSuggestions {
    private readonly suggestionCache: Map<string, AutocompleteTag[]> = new Map();
    private fetchAbort: AbortController = new AbortController();
    private lastContent: string = "";

    public suggestions: TagSuggestionStatus = $state('none');

    public onCurrentNodeChange = (currentNode: Node) => {
        if (
            currentNode instanceof ContentTagNode &&
            currentNode.length() !== 0
        ) {
            const content = currentNode.content;

            if (this.lastContent === content) {
                return;
            } else {
                this.fetchAbort.abort();
                this.lastContent = content;
            }

            const cachedResult = this.suggestionCache.get(content);
            if (cachedResult !== undefined) {
                this.suggestions = cachedResult;

                return;
            }

            const abort = new AbortController();
            this.fetchAbort = abort;
            setTimeout(() => {
                if (abort.signal.aborted) {
                    return;
                }

                fetch(
                    `/tag/autocomplete?like=${encodeURIComponent(content)}`,
                    {
                        signal: abort.signal,
                    },
                )
                    .then(async (response) => {
                        if (response.status !== 200) {
                            this.suggestions = "none";
                            return;
                        }

                        const result: AutocompleteTag[] =
                            await response.json();
                        this.suggestionCache.set(content, result);
                        if (this.suggestionCache.size > 100) {
                            const firstKey = this.suggestionCache.keys().next().value!;
                            this.suggestionCache.delete(firstKey);
                        }

                        this.suggestions = result;
                    })
                    .catch((error) => {
                        if (error.name !== "AbortError") {
                            throw error;
                        }
                    });
            }, 200);

            this.suggestions = "loading";
        } else {
            this.fetchAbort.abort();

            this.suggestions = "none";
        }
    }
}