<script lang="ts">
    import { browser } from "$app/environment";
    import { page } from "$app/state";
    import { Command, computeCommandScore, Dialog } from "bits-ui";
    import { createFloatingActions } from "svelte-floating-ui";
    import { offset, size } from "svelte-floating-ui/dom";
    import { goto, invalidateAll } from "$app/navigation";
    import DialogOverlay from "$lib/DialogOverlay.svelte";
    import { tick, type Snippet } from "svelte";
    import type { LayoutProps } from "../../routes/$types";
    import {
        AndNode,
        ContentTagNode,
        isComparativePrefixTagNode,
        isSimplePrefixTagNode,
        OrNode,
        PrefixTagNode,
        RatingPrefixTagNode,
        SortPrefixTagNode,
        TagNode,
        type Comparison,
        type NodeReference,
    } from "./searchTree";
    import type { KeyboardEventHandler } from "svelte/elements";
    import { assert } from "$lib/Utils";
    import type { AutocompleteTag } from "$lib/gelbooru";
    import TagSuggestions, {
        type TagSuggestionStatus,
    } from "./TagSuggestions.svelte";

    type Constraint = "require" | "indifferent" | "requireNot";
    type SuggestionConstraints = {
        isSortOrdering: Constraint;
        isSortOption: Constraint;
        isRating: Constraint;
        isComparisonOperator: Constraint;
        isTag: Constraint;
        isPrefixTag: Constraint;
        isNegatable: Constraint;
        isGlobable: Constraint;
        isInsideOr: Constraint;
        isSignedIn: Constraint;
        isCurrentSearchSaved: Constraint;
        isCurrentSearchEmpty: Constraint;
        isSoFarExactMatch: Constraint;
    };
    const defaultConstraints: SuggestionConstraints = {
        isSortOrdering: "indifferent",
        isSortOption: "indifferent",
        isRating: "indifferent",
        isComparisonOperator: "indifferent",
        isTag: "indifferent",
        isPrefixTag: "indifferent",
        isNegatable: "indifferent",
        isGlobable: "indifferent",
        isInsideOr: "indifferent",
        isSignedIn: "indifferent",
        isCurrentSearchSaved: "indifferent",
        isCurrentSearchEmpty: "indifferent",
        isSoFarExactMatch: "indifferent",
    };
    const headings = [
        "Saved Searches",
        "Actions",
        "Operators",
        "Prefixes",
    ] as const;
    type SuggestionEntry<Data> = {
        name: string;
        constraints: SuggestionConstraints;
        title?: { snippet: Snippet<[Data]>; data: Data };
        icon?: Snippet;
        onSelect?: () => void;
    };
    type WrapHeaders<Heading> = {
        [Index in keyof Heading]: Index extends keyof []
            ? Heading[Index]
            : {
                  heading: Heading[Index];
                  isSeparated: boolean;
                  entries: SuggestionEntry<any>[];
              };
    };
    type SuggestionEntries = [
        {
            heading: undefined;
            isSeparated: boolean;
            entries: SuggestionEntry<any>[];
        },
        ...WrapHeaders<typeof headings>,
    ];

    let isCommandMenuOpen = $state(false);
    let commandRoot: Command.Root | undefined = undefined;
    let suggestionsInput: HTMLInputElement | null = $state(null);

    let tags = $derived(
        AndNode.fromString(page.url.searchParams.get("tags") ?? ""),
    );

    let tagsSerialized = $derived(tags.toString());
    $effect(() => {
        tagsSerialized;

        if (
            suggestionsInput !== null &&
            suggestionsInput.value !== tagsSerialized
        ) {
            suggestionsInput.value = tagsSerialized;
        }
    });

    const getCurrentTag = (caratStartIndex: number) => {
        const result = tags.getNodeAt(caratStartIndex);
        if (result.status === "found") {
            return result;
        } else {
            return tags.frontNodeReference(tagsSerialized.length, []);
        }
    };
    let currentNode: NodeReference = $state(
        getCurrentTag((() => tagsSerialized)().length),
    );
    $effect(() => {
        if (suggestionsInput === null) {
            return;
        }

        const newCaratStart =
            currentNode.nodeStartTextOffset + currentNode.offset;
        if (suggestionsInput.selectionStart !== newCaratStart) {
            suggestionsInput.focus({
                preventScroll: true,
            });
            suggestionsInput.setSelectionRange(newCaratStart, newCaratStart);
        }
    });

    const tagSuggestions = new TagSuggestions();
    $effect(() => {
        tagSuggestions.onCurrentNodeChange(currentNode.node);
    });

    let savedSearches: string[] = $state(
        browser
            ? JSON.parse(localStorage.getItem("saved_searches") ?? "[]")
            : [],
    );
    $effect(() => {
        localStorage.setItem("saved_searches", JSON.stringify(savedSearches));
    });

    const search = () => {
        isCommandMenuOpen = false;

        const url = page.url;
        url.searchParams.set("tags", tagsSerialized);
        url.pathname = "";
        goto(url, {
            invalidate: ["data:posts"],
        });
    };

    const tryMapCurrentTag = (
        op: (
            content: string,
            offset: number,
        ) => { newContent: string; offset: number } | undefined,
    ) => {
        const immediateParent = currentNode.parents[0];
        if (
            immediateParent === undefined ||
            !(currentNode.node instanceof TagNode)
        ) {
            return false;
        }

        const result = op(currentNode.node.content, currentNode.offset);
        if (result === undefined) return false;
        const { newContent, offset } = result;

        const nodeReplacementResult = immediateParent.node.replaceNodeAt(
            currentNode.nodeStartTextOffset,
            immediateParent.childIndex,
            TagNode.parseTag(newContent),
            currentNode.parents.slice(1),
        );
        assert(nodeReplacementResult !== undefined);

        currentNode = {
            ...nodeReplacementResult,
            offset: offset,
        };
        tagsSerialized = tags.toString();

        return true;
    };
    const findLongestCommonPrefixUpTo = (input: string, value: string) => {
        for (
            let searchLength = value.length;
            searchLength > 1;
            searchLength--
        ) {
            const prefix = value.slice(0, searchLength);
            if (input.endsWith(prefix)) {
                return input.length - searchLength;
            }
        }

        return undefined;
    };
    const tryCompleteCurrentTag = (withValue: string) => {
        const result = tryMapCurrentTag((content) => {
            const completeFromIndex = findLongestCommonPrefixUpTo(
                content,
                withValue,
            );
            if (completeFromIndex === undefined) {
                return undefined;
            }

            return {
                newContent: withValue,
                offset: withValue.length,
            };
        });
        if (result) {
            commandRoot?.updateSelectedToIndex(0);
        }

        return result;
    };

    const replaceEntireInput = (withValue: string) => {
        return () => {
            tags = AndNode.fromString(withValue);
            currentNode = tags.frontNodeReference(withValue.length, []);

            tagsSerialized = tags.toString();
            commandRoot?.updateSelectedToIndex(0);
        };
    };

    const insertCurrentPosition = (symbol: string) => {
        return () => {
            const result = tryMapCurrentTag((content, offset) => {
                const newContent =
                    content.slice(0, currentNode.offset) +
                    symbol +
                    content.slice(currentNode.offset);

                return { newContent, offset: offset + symbol.length };
            });

            if (result) commandRoot?.updateSelectedToIndex(0);
        };
    };

    const removeCurrentTag = () => {
        const immediateParent = currentNode.parents[0];
        if (
            immediateParent === undefined ||
            !(currentNode.node instanceof TagNode)
        ) {
            return;
        }

        const newReference = immediateParent.node.deleteNodeAt(
            currentNode.nodeStartTextOffset,
            immediateParent.childIndex,
            currentNode.parents.slice(1),
        );
        currentNode = newReference;

        tagsSerialized = tags.toString();
        commandRoot?.updateSelectedToIndex(0);
    };

    const replaceCurrentTag = (value: string) => {
        return () => {
            const result = tryMapCurrentTag(() => {
                return { newContent: value, offset: value.length };
            });

            if (result) {
                commandRoot?.updateSelectedToIndex(0);
            }
        };
    };

    const completeOrAddNewTagAfterCurrentTag = (value: string) => {
        return () => {
            const completeResult = tryCompleteCurrentTag(value);
            if (completeResult) return;

            const immediateParent = currentNode.parents[0];
            if (
                immediateParent === undefined ||
                !(currentNode.node instanceof TagNode)
            ) {
                return;
            }

            const rightTag = TagNode.parseTag(value);
            const nodeInsertionResult = immediateParent.node.appendNodeAt(
                currentNode.nodeStartTextOffset + currentNode.node.length(),
                immediateParent.childIndex,
                rightTag,
                currentNode.parents.slice(1),
            );
            assert(nodeInsertionResult !== undefined);

            currentNode = {
                ...nodeInsertionResult,
                offset: rightTag.length(),
            };
            tagsSerialized = tags.toString();
            commandRoot?.updateSelectedToIndex(0);
        };
    };

    const prefixOrCompleteCurrentTag = (prefix: string) => {
        return () => {
            const completeResult = tryCompleteCurrentTag(prefix);
            if (completeResult) return;

            const result = tryMapCurrentTag((content, offset) => {
                return {
                    newContent: prefix + content,
                    offset: offset + prefix.length,
                };
            });

            if (result) commandRoot?.updateSelectedToIndex(0);
        };
    };

    const postfixCurrentTag = (postfix: string) => {
        return () => {
            const result = tryMapCurrentTag((content, offset) => {
                return { newContent: content + postfix, offset };
            });

            if (result) commandRoot?.updateSelectedToIndex(0);
        };
    };

    const setSimpleValue = (value: string) => {
        return () => {
            if (isSimplePrefixTagNode(currentNode.node)) {
                currentNode.node.value = value;

                currentNode = {
                    ...currentNode,
                    offset: currentNode.node.length(),
                };
                tagsSerialized = tags.toString();
                commandRoot?.updateSelectedToIndex(0);
            }
        };
    };
    const setSortOrderValue = (order: string) => {
        return () => {
            if (currentNode.node instanceof SortPrefixTagNode) {
                currentNode.node.order = order;

                currentNode = {
                    ...currentNode,
                    offset: currentNode.node.length(),
                };
                tagsSerialized = tags.toString();
                commandRoot?.updateSelectedToIndex(0);
            }
        };
    };
    const setSortOptionValue = (option: string) => {
        return () => {
            if (currentNode.node instanceof SortPrefixTagNode) {
                currentNode.node.option = option;

                currentNode = {
                    ...currentNode,
                    offset: 5 + option.length,
                };
                tagsSerialized = tags.toString();
                commandRoot?.updateSelectedToIndex(0);
            }
        };
    };
    const setComparisonOperator = (operator: Comparison) => {
        return () => {
            if (isComparativePrefixTagNode(currentNode.node)) {
                currentNode.node.comparison = operator;

                currentNode = {
                    ...currentNode,
                    offset:
                        currentNode.node.length() -
                        currentNode.node.value.length,
                };
                tagsSerialized = tags.toString();
                commandRoot?.updateSelectedToIndex(0);
            }
        };
    };

    const orCurrentTag = () => {
        const immediateParent = currentNode.parents[0];

        if (immediateParent === undefined) {
            assert(currentNode.node instanceof AndNode);

            const or = new OrNode([]);
            const children = currentNode.node.children;
            children.push(or);
            currentNode.node.children = children;

            currentNode = {
                node: or,
                nodeStartTextOffset: 0,
                offset: 1,
                parents: [{ node: currentNode.node, childIndex: 0 }],
            };
        } else {
            if (
                currentNode.node instanceof TagNode &&
                currentNode.node.length() === 0
            ) {
                const nodeReplacementResult =
                    immediateParent.node.replaceNodeAt(
                        currentNode.nodeStartTextOffset,
                        immediateParent.childIndex,
                        new OrNode([]),
                        currentNode.parents.slice(1),
                    );
                assert(nodeReplacementResult !== undefined);

                currentNode = {
                    ...nodeReplacementResult,
                    offset: 1,
                };
            } else {
                const insertionNode = new OrNode([currentNode.node]);
                const nodeReplacementResult =
                    immediateParent.node.replaceNodeAt(
                        currentNode.nodeStartTextOffset,
                        immediateParent.childIndex,
                        insertionNode,
                        currentNode.parents.slice(1),
                    );
                assert(nodeReplacementResult !== undefined);

                currentNode = {
                    ...currentNode,
                    nodeStartTextOffset: currentNode.nodeStartTextOffset + 1,
                    parents: [
                        {
                            node: insertionNode,
                            childIndex: 0,
                        },
                        ...currentNode.parents,
                    ],
                };
            }
        }

        tagsSerialized = tags.toString();
    };

    const saveCurrentSearch = () => {
        const currentSearch = page.url.searchParams.get("tags") ?? "";
        if (currentSearch !== "") {
            savedSearches = savedSearches.filter(
                (savedSearch) => savedSearch !== currentSearch,
            );
            savedSearches.push(currentSearch);

            removeCurrentTag();
            isCommandMenuOpen = false;
        }
    };
    const unsaveCurrentSearch = () => {
        const currentSearch = page.url.searchParams.get("tags") ?? "";
        savedSearches = savedSearches.filter(
            (savedSearch) => savedSearch !== currentSearch,
        );

        removeCurrentTag();
        isCommandMenuOpen = false;
    };
    const signOut = () => {
        fetch("/signout", {
            method: "POST",
        }).then(() => invalidateAll());

        removeCurrentTag();
        isCommandMenuOpen = false;
    };

    const [floatingRef, floatingContent] = createFloatingActions({
        strategy: "fixed",
        placement: "bottom",
        middleware: [
            size({
                apply({ rects, elements }) {
                    Object.assign(elements.floating.style, {
                        minWidth: `${rects.reference.width}px`,
                        minHeight: `${rects.reference.height}px`,
                    });
                },
            }),
            offset(({ rects }) => {
                return {
                    mainAxis: -rects.reference.height,
                };
            }),
        ],
    });

    const isConstraintBroken = (
        constraint: Constraint,
        isConditionMet: boolean,
    ) => {
        return (
            (isConditionMet && constraint === "requireNot") ||
            (!isConditionMet && constraint === "require")
        );
    };
    type FilteredSuggestionEntries = (
        | {
              heading: string | undefined;
              isSeparated: boolean;
              entries: SuggestionEntry<any>[];
          }
        | "loader"
    )[];
    const filterSuggestionEntries = (
        unfilteredSuggestions: SuggestionEntries,
        currentTag: NodeReference,
        tagsSerialized: string,
        savedSearches: string[],
        tagAutocompleteSuggestions: TagSuggestionStatus,
        user: LayoutProps["data"]["user"],
    ): FilteredSuggestionEntries => {
        const isRating =
            currentTag.node instanceof RatingPrefixTagNode &&
            currentTag.node.isInsideValue(currentTag.offset);
        const isComparisonOperator =
            isComparativePrefixTagNode(currentTag.node) &&
            currentTag.node.isInsideComparison(currentTag.offset);
        const isSortOption =
            currentTag.node instanceof SortPrefixTagNode &&
            currentTag.node.isInsideOption(currentTag.offset);
        const isSortOrdering =
            currentTag.node instanceof SortPrefixTagNode &&
            currentTag.node.isInsideOrder(currentTag.offset) &&
            currentTag.node.option !== "random";
        const isTag = currentTag.node instanceof TagNode;
        const isPrefixTag = currentTag.node instanceof PrefixTagNode;
        const isNegatable =
            currentTag.node instanceof TagNode &&
            currentTag.node.isNegatable(currentTag.offset);
        const isGlobable =
            currentTag.node instanceof TagNode &&
            currentTag.node.isGlobable(currentTag.offset);
        const isInsideOr = currentTag.parents.some(
            (parent) => parent instanceof OrNode,
        );
        const isSignedIn = user !== undefined;
        const isCurrentSearchSaved = savedSearches.includes(
            page.url.searchParams.get("tags") ?? "",
        );
        const isCurrentSearchEmpty =
            (page.url.searchParams.get("tags") ?? "") === "";

        let unsortedEntries = unfilteredSuggestions.map((entry) => {
            return {
                ...entry,
                entries: entry.entries.filter((suggestion) => {
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isSortOrdering,
                            isSortOrdering,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isSortOption,
                            isSortOption,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isRating,
                            isRating,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isComparisonOperator,
                            isComparisonOperator,
                        )
                    )
                        return false;
                    if (isConstraintBroken(suggestion.constraints.isTag, isTag))
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isPrefixTag,
                            isPrefixTag,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isNegatable,
                            isNegatable,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isGlobable,
                            isGlobable,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isInsideOr,
                            isInsideOr,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isSignedIn,
                            isSignedIn,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isCurrentSearchSaved,
                            isCurrentSearchSaved,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isCurrentSearchEmpty,
                            isCurrentSearchEmpty,
                        )
                    )
                        return false;
                    if (
                        isConstraintBroken(
                            suggestion.constraints.isSoFarExactMatch,
                            !(currentTag.node instanceof TagNode) ||
                                suggestion.name
                                    .toLowerCase()
                                    .startsWith(
                                        currentTag.node.content.toLowerCase(),
                                    ),
                        )
                    )
                        return false;

                    return true;
                }),
            };
        }) as FilteredSuggestionEntries;

        const searchSuggestionEntry = {
            heading: undefined,
            isSeparated: true,
            entries: [
                {
                    name: `Search for "${tagsSerialized}"`,
                    constraints: defaultConstraints,
                    onSelect: search,
                    icon: searchIcon,
                },
            ],
        };

        if (!isTag) {
            return [searchSuggestionEntry, ...unsortedEntries];
        }

        const separatedEntries = [];
        const restSuggestions = [];
        for (const entry of unsortedEntries) {
            assert(entry !== "loader");
            if (entry.isSeparated) {
                separatedEntries.push(entry);
            } else {
                restSuggestions.push(...entry.entries);
            }
        }

        const currentTagContent = (currentTag.node as TagNode).currentSegment(
            currentTag.offset,
        );
        const sort = (
            left: SuggestionEntry<any>,
            right: SuggestionEntry<any>,
        ) => {
            const leftWeightOffset =
                left.constraints.isSoFarExactMatch === "require" ? 0.25 : 0;
            const rightWeightOffset =
                right.constraints.isSoFarExactMatch === "require" ? 0.25 : 0;

            return (
                computeCommandScore(right.name, currentTagContent) -
                rightWeightOffset -
                (computeCommandScore(left.name, currentTagContent) +
                    leftWeightOffset)
            );
        };
        separatedEntries.forEach((entry) => entry.entries.sort(sort));
        restSuggestions.sort(sort);

        const result: FilteredSuggestionEntries = [searchSuggestionEntry];
        if (tagAutocompleteSuggestions === "loading") {
            result.push("loader");
        } else if (tagAutocompleteSuggestions !== "none") {
            result.push({
                heading: undefined,
                isSeparated: true,
                entries: tagAutocompleteSuggestions.map(
                    (autocompleteSuggestion) => {
                        return {
                            name: autocompleteSuggestion.value,
                            constraints: defaultConstraints,
                            title: {
                                snippet: autocompleteTagTitle,
                                data: autocompleteSuggestion,
                            },
                            onSelect: replaceCurrentTag(
                                autocompleteSuggestion.value,
                            ),
                        };
                    },
                ),
            });
        }

        return [
            ...result,
            ...separatedEntries,
            {
                heading: undefined,
                isSeparated: false,
                entries: restSuggestions,
            },
        ];
    };

    const unfilteredSuggestions: SuggestionEntries = $derived([
        {
            heading: undefined,
            isSeparated: true,
            entries: [
                {
                    name: "asc",
                    constraints: {
                        ...defaultConstraints,
                        isSortOrdering: "require",
                    },
                    onSelect: setSortOrderValue("asc"),
                },
                {
                    name: "desc",
                    constraints: {
                        ...defaultConstraints,
                        isSortOrdering: "require",
                    },
                    onSelect: setSortOrderValue("desc"),
                },

                {
                    name: "random",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("random"),
                },
                {
                    name: "id",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("id"),
                },
                {
                    name: "score",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("score"),
                },
                {
                    name: "user",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("user"),
                },
                {
                    name: "height",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("height"),
                },
                {
                    name: "width",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("width"),
                },
                {
                    name: "source",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("source"),
                },
                {
                    name: "updated",
                    constraints: {
                        ...defaultConstraints,
                        isSortOption: "require",
                    },
                    onSelect: setSortOptionValue("updated"),
                },

                {
                    name: "general",
                    constraints: { ...defaultConstraints, isRating: "require" },
                    onSelect: setSimpleValue("general"),
                },
                {
                    name: "sensitive",
                    constraints: { ...defaultConstraints, isRating: "require" },
                    onSelect: setSimpleValue("sensitive"),
                },
                {
                    name: "questionable",
                    constraints: { ...defaultConstraints, isRating: "require" },
                    onSelect: setSimpleValue("questionable"),
                },
                {
                    name: "explicit",
                    constraints: { ...defaultConstraints, isRating: "require" },
                    onSelect: setSimpleValue("explicit"),
                },

                {
                    name: ">",
                    constraints: {
                        ...defaultConstraints,
                        isComparisonOperator: "require",
                    },
                    onSelect: setComparisonOperator(">"),
                },
                {
                    name: "<",
                    constraints: {
                        ...defaultConstraints,
                        isComparisonOperator: "require",
                    },
                    onSelect: setComparisonOperator("<"),
                },
                {
                    name: ">=",
                    constraints: {
                        ...defaultConstraints,
                        isComparisonOperator: "require",
                    },
                    onSelect: setComparisonOperator(">="),
                },
                {
                    name: "<=",
                    constraints: {
                        ...defaultConstraints,
                        isComparisonOperator: "require",
                    },
                    onSelect: setComparisonOperator("<="),
                },
            ],
        },
        {
            heading: "Saved Searches",
            isSeparated: false,
            entries: Array(...savedSearches)
                .reverse()
                .map((savedSearch) => {
                    return {
                        name: savedSearch,
                        constraints: {
                            ...defaultConstraints,
                            isSoFarExactMatch: "require",
                        },
                        onSelect: replaceEntireInput(savedSearch),
                    };
                }),
        },
        {
            heading: "Actions",
            isSeparated: false,
            entries: [
                {
                    name: "Save current search",
                    constraints: {
                        ...defaultConstraints,
                        isSoFarExactMatch: "require",
                        isCurrentSearchEmpty: "requireNot",
                        isCurrentSearchSaved: "requireNot",
                    },
                    onSelect: saveCurrentSearch,
                    heading: "Actions",
                },
                {
                    name: "Unsave current search",
                    constraints: {
                        ...defaultConstraints,
                        isSoFarExactMatch: "require",
                        isCurrentSearchSaved: "require",
                    },
                    onSelect: unsaveCurrentSearch,
                    heading: "Actions",
                },
                {
                    name: "Sign out",
                    constraints: {
                        ...defaultConstraints,
                        isSoFarExactMatch: "require",
                        isSignedIn: "require",
                    },
                    onSelect: signOut,
                    heading: "Actions",
                },
            ],
        },
        {
            heading: "Operators",
            isSeparated: false,
            entries: [
                {
                    name: "Glob",
                    constraints: {
                        ...defaultConstraints,
                        isGlobable: "require",
                    },
                    onSelect: insertCurrentPosition("*"),
                    icon: globIcon,
                },
                {
                    name: "Not",
                    constraints: {
                        ...defaultConstraints,
                        isNegatable: "require",
                    },
                    onSelect: prefixOrCompleteCurrentTag("-"),
                    icon: notIcon,
                },
                {
                    name: "Fuzzy",
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                    },
                    onSelect: postfixCurrentTag("~"),
                    icon: fuzzyIcon,
                },
                {
                    name: "Or",
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                    },
                    onSelect: () => {
                        orCurrentTag();
                        commandRoot?.updateSelectedToIndex(0);
                    },
                    icon: orIcon,
                },
            ],
        },

        {
            heading: "Prefixes",
            isSeparated: false,
            entries: [
                {
                    name: "Rating",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Rating:", prefix: "rating:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("rating:"),
                },
                {
                    name: "User",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "User:", prefix: "user:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("user:"),
                },
                {
                    name: "Hash",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Hash:", prefix: "md5:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("md5:"),
                },
                {
                    name: "Width",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Width:", prefix: "width:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("width:"),
                },
                {
                    name: "Height",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Height:", prefix: "height:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("height:"),
                },
                {
                    name: "Score",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Score:", prefix: "score:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("score:"),
                },
                {
                    name: "Pool",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Pool:", prefix: "pool:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("pool:"),
                },
                {
                    name: "Sort",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Sort:", prefix: "sort:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("sort:"),
                },
                {
                    name: "Source",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Source:", prefix: "source:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("source:"),
                },
                {
                    name: "Favorited by",
                    title: {
                        snippet: prefixItemTitleOfCurrentTag,
                        data: { title: "Favorited by:", prefix: "fav:" },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                    },
                    onSelect: prefixOrCompleteCurrentTag("fav:"),
                    heading: "Prefixes",
                },
                {
                    name: "My favorites",
                    title: {
                        snippet: prefixItemTitle,
                        data: {
                            title: "My favorites:",
                            prefix: `fav:${page.data.user?.id ?? ""}`,
                        },
                    },
                    constraints: {
                        ...defaultConstraints,
                        isTag: "require",
                        isPrefixTag: "requireNot",
                        isInsideOr: "requireNot",
                        isSignedIn: "require",
                    },
                    onSelect: () =>
                        completeOrAddNewTagAfterCurrentTag(
                            "fav:" + page.data.user.id,
                        )(),
                    heading: "Prefixes",
                },
            ],
        },
    ]);

    const filteredSuggestions: FilteredSuggestionEntries = $derived(
        filterSuggestionEntries(
            unfilteredSuggestions,
            currentNode,
            tagsSerialized,
            savedSearches,
            tagSuggestions.suggestions,
            page.data.user,
        ).filter(
            (heading) => heading === "loader" || heading.entries.length !== 0,
        ),
    );

    const onKeydown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();

            currentNode = currentNode.node.onBackArrow(currentNode);
        }

        // TODO: My right arrow key is broken, remove the ArrowUp I put here for testing.
        if (event.key === "ArrowRight") {
            event.preventDefault();

            currentNode = currentNode.node.onForwardArrow(currentNode);
        }

        // TODO: Some buggy behavior on FireFox
        if (event.key === " ") {
            event.preventDefault();

            const newReference = currentNode.node.onSpace(currentNode);
            tagsSerialized = tags.toString();
            currentNode = newReference;
        }

        if (event.key === "Backspace") {
            event.preventDefault();

            const newReference = currentNode.node.onBackspace(currentNode);
            tagsSerialized = tags.toString();
            currentNode = newReference;
        }

        if (event.key === "{" || event.key === "}") {
            event.preventDefault();

            orCurrentTag();
        }

        tick().then(() =>
            setTimeout(() => {
                if (suggestionsInput !== null) {
                    const caratStartIndex = suggestionsInput!.selectionStart;
                    if (caratStartIndex !== null) {
                        currentNode = getCurrentTag(caratStartIndex);
                    }
                }
            }, 0),
        );
    };
</script>

<Dialog.Root bind:open={isCommandMenuOpen}>
    <form
        method="GET"
        action="/"
        onsubmit={(event) => event.preventDefault()}
        role={browser ? "none" : "search"}
        class="flex px-3.5 h-10 outline outline-invisibles-calculated -outline-offset-1 !outline-solid rounded-4xl items-center p-1 gap-2.5 transition-colors duration-100 ease-out bg-neutral-400 grow appearance-none"
        use:floatingRef
    >
        <button
            onclick={search}
            type="submit"
            aria-label="Submit"
            class="flex-center"
        >
            <i class="fa-solid fa-magnifying-glass"></i>
        </button>
        {#if browser}
            <Dialog.Trigger class="grow text-left">
                {#if tagsSerialized.length === 0}
                    <span class="text-neutral-700/50" aria-hidden="true">
                        Search...
                    </span>
                {:else}
                    <span class="sr-only">Current tags are</span>
                    {tagsSerialized}
                {/if}
            </Dialog.Trigger>
        {:else}
            <input
                type="search"
                class="w-full focus-visible:outline-none !appearance-none !p-0 cancel-button:appearance-none"
                spellcheck="false"
                name="tags"
                placeholder="Search..."
                value={tagsSerialized}
            />
        {/if}
    </form>
    <Dialog.Portal>
        <DialogOverlay />
        <Dialog.Content
            onOpenAutoFocus={(event) => {
                event.preventDefault();

                tagsSerialized = tags.toString();
                tick().then(() => {
                    const input = suggestionsInput!;
                    input.focus({ preventScroll: true });
                    input.setSelectionRange(
                        input.value.length,
                        input.value.length,
                    );

                    currentNode = getCurrentTag(input.value.length);
                });
            }}
        >
            <Dialog.Title class="sr-only">Search Menu</Dialog.Title>
            <Dialog.Description class="sr-only">
                This is the search menu. Use arrow keys to navigate between
                suggestions and actions.
            </Dialog.Description>

            <Command.Root shouldFilter={false} bind:this={commandRoot}>
                {#snippet child({ props })}
                    <div
                        {...props}
                        class="fixed z-60 focus-visible:outline-0"
                        use:floatingContent
                    >
                        <div
                            class="rounded-[1.25rem] min-h-[inherit] overflow-hidden outline outline-invisibles-calculated -outline-offset-1 bg-neutral-350-radial w-full"
                        >
                            <div
                                class="gap-2.5 flex items-center h-10 rounded-4xl shadow-md/35 px-3.5 py-1.5 outline outline-invisibles-calculated -outline-offset-1 bg-neutral-400"
                            >
                                <button
                                    type="submit"
                                    aria-label="Search"
                                    class="flex-center"
                                    onclick={search}
                                >
                                    <i
                                        class="fa-solid fa-magnifying-glass"
                                        aria-hidden="true"
                                    ></i>
                                </button>
                                <Command.Input
                                    class="grow focus-visible:outline-none !appearance-none !p-0 cancel-button:appearance-none"
                                    placeholder="Search..."
                                    name="tags"
                                    bind:ref={suggestionsInput}
                                    onkeydown={onKeydown}
                                    oninput={(event) => {
                                        tags = AndNode.fromString(
                                            event.currentTarget.value,
                                        );
                                        tagsSerialized = tags.toString();
                                    }}
                                    onclick={() =>
                                        (currentNode = getCurrentTag(
                                            suggestionsInput!.selectionStart ??
                                                0,
                                        ))}
                                />
                            </div>
                            <Command.List>
                                <Command.Viewport>
                                    {#snippet child({ props })}
                                        <div
                                            {...props}
                                            class="grow text-[0.95rem] max-h-96 scrollbar-thin overflow-y-auto"
                                        >
                                            <div class="p-2">
                                                {#each filteredSuggestions as heading, index}
                                                    {#if heading === "loader"}
                                                        <Command.Loading
                                                            class="flex-center px-3 h-8"
                                                        >
                                                            <i
                                                                class="fa-solid fa-spinner animate-spin size-4"
                                                            ></i>
                                                        </Command.Loading>
                                                    {:else}
                                                        <!-- TODO: Groups with sr-only group headings -->
                                                        {#if heading.heading !== undefined}
                                                            <Command.Group>
                                                                <Command.GroupHeading
                                                                    class="text-invisibles pl-2 pr-3 pb-1 pt-1.5 flex items-center"
                                                                    aria-hidden="true"
                                                                >
                                                                    {heading.heading}
                                                                </Command.GroupHeading>
                                                                <Command.GroupItems
                                                                >
                                                                    {#each heading.entries as suggestion}
                                                                        {@render suggestionComponent(
                                                                            suggestion,
                                                                        )}
                                                                    {/each}
                                                                </Command.GroupItems>
                                                            </Command.Group>
                                                        {:else}
                                                            {#each heading.entries as suggestion}
                                                                {@render suggestionComponent(
                                                                    suggestion,
                                                                )}
                                                            {/each}
                                                        {/if}
                                                        {#if heading.isSeparated && filteredSuggestions.length !== index + 1}
                                                            <Command.Separator
                                                                forceMount
                                                                class="border-b border-invisibles/50 pt-2 mb-1.5 mx-2"
                                                            />
                                                        {/if}
                                                    {/if}
                                                {/each}
                                            </div>
                                        </div>
                                    {/snippet}
                                </Command.Viewport>
                            </Command.List>
                        </div>
                    </div>
                {/snippet}
            </Command.Root>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>

{#snippet suggestionComponent(suggestionEntry: SuggestionEntry<any>)}
    <Command.Item
        onSelect={suggestionEntry.onSelect}
        class="data-selected:bg-invisibles px-3 h-8 cursor-pointer rounded-xl flex items-center gap-3 leading-1 group scroll-my-2 scroll-py-2"
    >
        {@render suggestionEntry.icon?.()}
        {#if suggestionEntry.title !== undefined}
            {@render suggestionEntry.title.snippet(suggestionEntry.title.data)}
        {:else}
            {suggestionEntry.name}
        {/if}
    </Command.Item>
{/snippet}

{#snippet autocompleteTagTitle(data: AutocompleteTag)}
    {@const type = data.category}
    <span>
        <span
            class:text-metadata-tag={type === "metadata"}
            class:text-artist-tag={type === "artist"}
            class:text-copyright-tag={type === "copyright"}
            class:text-character-tag={type === "character"}
            class:text-deprecated-tag={type === "deprecated"}
            class:line-through={type === "deprecated"}
        >
            {data.value}
        </span>
        <span class="text-white/50 ml-1">
            {data.post_count}
        </span>
    </span>
{/snippet}
{#snippet prefixItemTitle(data: { title: string; prefix: string })}
    <span>
        {data.title}
        <span class="text-white/50 ml-1 hidden group-data-selected:inline">
            {data.prefix}
        </span>
    </span>
{/snippet}
{#snippet prefixItemTitleOfCurrentTag(data: { title: string; prefix: string })}
    {@render prefixItemTitle({
        ...data,
        prefix:
            currentNode.node instanceof TagNode
                ? data.prefix + currentNode.node.content
                : data.prefix,
    })}
{/snippet}
{#snippet searchIcon()}
    <i class="fa-solid fa-magnifying-glass size-4" aria-hidden="true"></i>
{/snippet}
{#snippet globIcon()}
    <span class="text-2xl leading-1 mt-6 size-4" aria-hidden="true"> * </span>
{/snippet}
{#snippet notIcon()}
    <span class="text-2xl leading-1 mt-3 size-4" aria-hidden="true"> - </span>
{/snippet}
{#snippet fuzzyIcon()}
    <span class="text-2xl leading-1 mt-3 size-4" aria-hidden="true"> ~ </span>
{/snippet}
{#snippet orIcon()}
    <span class="text-lg leading-1 mt-3 size-4" aria-hidden="true"> | </span>
{/snippet}
