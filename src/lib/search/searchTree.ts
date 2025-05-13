// Do not read this code, please for the love of god.

import { dev } from "$app/environment";
import { assert } from "$lib/Utils";

type ParseResult = { status: "success", node: Node, restInput: string } | { status: "dispose", restInput: string } | { status: "reject" };
type Parents = { node: IParentNode, childIndex: number }[];
export type NodeReference = { offset: number, node: Node, nodeStartTextOffset: number, parents: Parents }
type NodeResult = { status: "continue", length: number } | { status: "found" } & NodeReference;

export abstract class Node {
    public static tryParse: (input: string) => ParseResult;

    public abstract getNodeAt(textOffset: number): NodeResult;

    public abstract onBackArrow(reference: NodeReference): NodeReference;
    public abstract onForwardArrow(reference: NodeReference): NodeReference;

    public abstract onSpace(reference: NodeReference): NodeReference;
    public abstract onBackspace(reference: NodeReference): NodeReference;

    public tryMergeSibling(reference: NodeReference, leftNode: Node, leftNodeEndTextOffset: number): NodeReference | undefined {
        return undefined;
    }

    public abstract frontNodeReference(nodeEndTextOffset: number, parents: Parents): NodeReference;

    public abstract toString: () => string;
}

interface IParentNode extends Node {
    get children(): Node[];
    set children(children: Node[]);

    previousNodeReference(childNodeStartTextOffset: number, childIndex: number, parents: Parents): NodeReference;
    nextNodeReference(childNodeEndTextOffset: number, childIndex: number, parents: Parents): NodeReference;

    /// Invalidates references to child if returns reference.
    prependNodeAt(childNodeStartTextOffset: number, childIndex: number, insertionNode: Node, parents: Parents): NodeReference | undefined;
    /// Does not invalidate references to child.
    appendNodeAt(childNodeEndTextOffset: number, childIndex: number, insertionNode: Node, parents: Parents): NodeReference | undefined;
    /// Invalidates references to child.
    deleteNodeAt(childNodeStartTextOffset: number, childIndex: number, parents: Parents): NodeReference;
    /// Invalidates references to child.
    unseparateNodeAt(childNodeStartTextOffset: number, childIndex: number, parents: Parents): NodeReference;
    /// invalidates references to child if returns reference.
    replaceNodeAt(childNodeStartTextOffset: number, childIndex: number, insertionNode: Node, parents: Parents): NodeReference | undefined;
}
const ParentNode = (beginning: string, separators: [string, ...string[]], ending: string, findEnd: (input: string) => number | -1) => {
    return class ParentNode extends Node implements IParentNode {
        #children: Node[];

        public get children() {
            return this.#children.slice();
        }

        public set children(children: Node[]) {
            if (dev) {
                if (children.length !== 0 && children.every((child) => ParentNode.isEmptyTag(child))) {
                    throw Error(`Invalid tag group, contains only empty tags: ${children}`);
                }

                for (let index = 0; index < children.length; index++) {
                    const childLeft = children[index];
                    const childRight = children[index + 1];

                    if (ParentNode.isEmptyTag(childLeft) && ParentNode.isEmptyTag(childRight)) {
                        throw Error(`Invalid tag group, consecutive empty tags: ${children}`);
                    }
                }
            }

            this.#children = children.slice();
        }

        protected constructor(children: Node[]) {
            super();

            this.#children = children;
            if (dev) this.children = this.#children;
        }


        public static fromChildren: (children: Node[]) => Node;
        public static tryParse(input: string): ParseResult {
            if (input.indexOf(beginning) === 0) {
                const endingIndex = findEnd(input.slice(beginning.length));

                if (endingIndex === -1) {
                    return { status: "success", node: this.fromChildren([]), restInput: input.slice(beginning.length) }
                }

                const restInput = input.slice(endingIndex + ending.length)

                let children = [];
                let nodeContentsInput = input.slice(beginning.length, endingIndex);
                while (true) {
                    let child;
                    for (const tryParse of childNodeParsers) {
                        const result = tryParse(nodeContentsInput);

                        if (result.status === "success") {
                            child = result.node;
                            nodeContentsInput = result.restInput;

                            break;
                        } else if (result.status === "dispose") {
                            nodeContentsInput = result.restInput;
                        }
                    }
                    if (child === undefined) {
                        throw Error("Failed to consume node while parsing, all grammar rules rejected");
                    }

                    const lastChild = children.at(-1);
                    if (!this.isEmptyTag(child) || !this.isEmptyTag(lastChild)) {
                        children.push(child);
                    }

                    if (nodeContentsInput.length === 0) {
                        break;
                    }

                    for (const separator of separators) {
                        const separatorIndex = nodeContentsInput.indexOf(separator);

                        if (separatorIndex !== -1) {
                            nodeContentsInput = nodeContentsInput.slice(separatorIndex + separator.length);
                            break;
                        }
                    }
                }

                if (children.every((child) => this.isEmptyTag(child))) {
                    children = [];
                }

                return { status: "success", node: this.fromChildren(children), restInput }
            } else if (input.indexOf(ending) === 0) {
                return { status: "success", node: this.fromChildren([]), restInput: input.slice(ending.length) }
            } else {
                return { status: "reject" }
            }
        };

        public toString = (): string => {
            return beginning +
                this.children.reduce<string>((result, node, index) => {
                    if (index !== 0) {
                        result += separators[0];
                    }

                    result += node.toString();

                    return result;
                }, "") +
                ending;
        }

        public getNodeAt(textOffset: number): NodeResult {
            let textOffsetFromStart = 0;

            if (textOffset < beginning.length) {
                return { status: "found", node: this, nodeStartTextOffset: 0, offset: 0, parents: [] };
            } else if (this.#children.length === 0 && textOffset === beginning.length) {
                return { status: "found", node: this, nodeStartTextOffset: 0, offset: beginning.length, parents: [] };
            }

            const children = this.children;
            textOffsetFromStart += beginning.length;
            for (let index = 0; index < children.length; index++) {
                if (index !== 0) {
                    textOffsetFromStart += separators[0].length;
                }

                const node = children[index];

                const result = node.getNodeAt(textOffset - textOffsetFromStart);
                if (result.status === "continue") {
                    textOffsetFromStart += result.length;
                } else {
                    return {
                        ...result,
                        nodeStartTextOffset: result.nodeStartTextOffset + textOffsetFromStart,
                        parents: [...result.parents, { node: this, childIndex: index }]
                    }
                }
            }
            textOffsetFromStart += ending.length;

            if (textOffset === textOffsetFromStart) {
                return { status: "found", node: this, nodeStartTextOffset: 0, offset: textOffsetFromStart, parents: [] };
            }

            return { status: "continue", length: textOffsetFromStart };
        }

        public onBackArrow(reference: NodeReference) {
            if (reference.offset === 0) {
                const immediateParent = reference.parents[0];
                if (immediateParent === undefined) {
                    if (this.#children.length === 0) {
                        return reference;
                    } else {
                        return {
                            node: this.#children[0],
                            offset: 0,
                            nodeStartTextOffset: reference.nodeStartTextOffset + beginning.length,
                            parents: [{ node: this, childIndex: 0 }]
                        };
                    }
                } else {
                    return immediateParent.node.previousNodeReference(
                        reference.nodeStartTextOffset,
                        immediateParent.childIndex,
                        reference.parents.slice(1)
                    );
                }
            } else if (reference.offset === beginning.length || this.#children.length === 0) {
                return { ...reference, offset: reference.offset - beginning.length };
            } else {
                return this.#children.at(-1)!.frontNodeReference(
                    reference.nodeStartTextOffset + reference.offset - ending.length,
                    [
                        { node: this, childIndex: this.#children.length - 1 },
                        ...reference.parents
                    ]
                );
            }
        }
        public onForwardArrow(reference: NodeReference) {
            if (reference.offset === 0) {
                const firstChild = this.#children[0];
                if (firstChild !== undefined) {
                    return {
                        node: firstChild,
                        offset: 0,
                        nodeStartTextOffset: reference.nodeStartTextOffset + beginning.length,
                        parents: [
                            { node: this, childIndex: 0 },
                            ...reference.parents
                        ]
                    }
                } else {
                    return { ...reference, offset: reference.offset + beginning.length };
                }
            } else if (reference.offset === beginning.length) {
                return { ...reference, offset: reference.offset + ending.length };
            } else {
                const immediateParent = reference.parents[0];
                if (immediateParent === undefined) {
                    return reference;
                } else {
                    return immediateParent.node.nextNodeReference(
                        reference.nodeStartTextOffset + reference.offset,
                        immediateParent.childIndex,
                        reference.parents.slice(1)
                    );
                }
            }
        }

        public onSpace(reference: NodeReference) {
            if (reference.offset === beginning.length) {
                return reference;
            } else if (reference.offset === 0) {
                const immediateParent = reference.parents[0];
                if (immediateParent === undefined) {
                    return reference;
                }

                return immediateParent.node.prependNodeAt(
                    reference.nodeStartTextOffset,
                    immediateParent.childIndex,
                    ContentTagNode.createEmpty(),
                    reference.parents.slice(1)
                ) ?? reference;
            } else {
                const immediateParent = reference.parents[0];
                if (immediateParent === undefined) {
                    return reference;
                }

                return immediateParent.node.appendNodeAt(
                    reference.nodeStartTextOffset + reference.offset,
                    immediateParent.childIndex,
                    ContentTagNode.createEmpty(),
                    reference.parents.slice(1)
                ) ?? reference;
            }
        }
        public onBackspace(reference: NodeReference) {
            const immediateParent = reference.parents[0];

            if (reference.offset === 0 || reference.offset === beginning.length) {
                if (immediateParent === undefined) {
                    const firstChild = this.#children[0];
                    if (reference.offset !== 0 && firstChild !== undefined) {
                        return {
                            node: firstChild,
                            nodeStartTextOffset: reference.nodeStartTextOffset + beginning.length,
                            offset: 0,
                            parents: [
                                { node: this, childIndex: 0 },
                                ...reference.parents
                            ]
                        };
                    } else {
                        return {
                            ...reference,
                            offset: 0
                        };
                    }
                }

                return immediateParent.node.deleteNodeAt(
                    reference.nodeStartTextOffset,
                    immediateParent.childIndex,
                    reference.parents.slice(1)
                );
            } else {
                if (immediateParent === undefined) {
                    const lastChild = this.#children.at(-1);

                    if (lastChild !== undefined) {
                        return lastChild.frontNodeReference(
                            reference.nodeStartTextOffset + reference.offset - ending.length,
                            [
                                { node: this, childIndex: this.#children.length - 1 },
                                ...reference.parents
                            ]
                        );
                    } else {
                        return {
                            ...reference,
                            offset: beginning.length
                        };
                    }
                }

                return immediateParent.node.deleteNodeAt(
                    reference.nodeStartTextOffset,
                    immediateParent.childIndex,
                    reference.parents.slice(1)
                );
            }
        }

        public prependNodeAt(childNodeStartTextOffset: number, childIndex: number, insertionNode: Node, parents: Parents) {
            if (ParentNode.isEmptyTag(insertionNode)) {
                if (ParentNode.isEmptyTag(this.#children[childIndex])) {
                    return undefined
                }

                const beforeNode = this.#children[childIndex - 1];
                if (beforeNode !== undefined && ParentNode.isEmptyTag(beforeNode)) {
                    return undefined
                }
            }

            const children = this.children;
            children.splice(childIndex, 1, insertionNode, children[childIndex]);
            this.children = children;

            return {
                node: insertionNode,
                offset: 0,
                nodeStartTextOffset: childNodeStartTextOffset,
                parents: [
                    { node: this, childIndex: childIndex },
                    ...parents
                ]
            };
        };
        public appendNodeAt(childNodeEndTextOffset: number, childIndex: number, insertionNode: Node, parents: Parents) {
            if (ParentNode.isEmptyTag(insertionNode)) {
                if (ParentNode.isEmptyTag(this.#children[childIndex])) {
                    return undefined
                }

                if (ParentNode.isEmptyTag(this.#children[childIndex + 1])) {
                    return undefined
                }
            }

            const children = this.children;
            children.splice(childIndex, 1, children[childIndex], insertionNode);
            this.children = children;

            return {
                node: insertionNode,
                offset: 0,
                nodeStartTextOffset: childNodeEndTextOffset + separators[0].length,
                parents: [
                    { node: this, childIndex: childIndex + 1 },
                    ...parents
                ]
            }
        };

        public deleteNodeAt(childNodeStartTextOffset: number, childIndex: number, parents: Parents): NodeReference {
            const children = this.children;
            children.splice(childIndex, 1);
            this.children = children;

            if (childIndex === 0) {
                const frontNode = this.#children[0];
                if (frontNode === undefined) {
                    return {
                        node: this,
                        nodeStartTextOffset: childNodeStartTextOffset - beginning.length,
                        offset: beginning.length,
                        parents,
                    };
                } else {
                    return {
                        node: frontNode,
                        nodeStartTextOffset: childNodeStartTextOffset,
                        offset: 0,
                        parents: [
                            { node: this, childIndex: 0 },
                            ...parents
                        ]
                    }
                }
            } else {
                return this.#children[childIndex - 1].frontNodeReference(
                    childNodeStartTextOffset - separators[0].length,
                    [{ node: this, childIndex },
                    ...parents]
                );
            }
        }

        public unseparateNodeAt(childNodeStartTextOffset: number, childIndex: number, parents: Parents): NodeReference {
            if (childIndex === 0) {
                return this.onBackspace({
                    node: this,
                    nodeStartTextOffset: childNodeStartTextOffset - beginning.length,
                    offset: beginning.length,
                    parents,
                });
            } else {
                const rightNode = this.#children[childIndex];
                const leftNode = this.#children[childIndex - 1];
                const mergeResult = rightNode.tryMergeSibling(
                    {
                        node: rightNode,
                        nodeStartTextOffset: childNodeStartTextOffset,
                        offset: 0,
                        parents: [
                            { node: this, childIndex },
                            ...parents
                        ]
                    },
                    leftNode,
                    childNodeStartTextOffset - separators[0].length
                );

                if (mergeResult === undefined) {
                    return this.deleteNodeAt(childNodeStartTextOffset, childIndex, parents);
                } else {
                    const children = this.children;
                    children.splice(childIndex - 1, 2, mergeResult.node);
                    this.children = children;

                    return mergeResult;
                }
            }
        }

        public replaceNodeAt(childNodeStartTextOffset: number, childIndex: number, insertionNode: Node, parents: Parents) {
            if (ParentNode.isEmptyTag(insertionNode)) {
                if (ParentNode.isEmptyTag(this.#children[childIndex - 1])) {
                    return undefined
                }

                if (ParentNode.isEmptyTag(this.#children[childIndex + 1])) {
                    return undefined
                }
            }

            this.#children[childIndex] = insertionNode;

            return {
                node: insertionNode,
                nodeStartTextOffset: childNodeStartTextOffset,
                offset: 0,
                parents: [
                    { node: this, childIndex },
                    ...parents
                ]
            }
        }

        public previousNodeReference(childNodeStartTextOffset: number, childIndex: number, parents: Parents) {
            if (childIndex > 0) {
                return this.#children[childIndex - 1].frontNodeReference(
                    childNodeStartTextOffset - separators[0].length,
                    [
                        { node: this, childIndex: childIndex - 1 },
                        ...parents
                    ]
                );
            } else {
                return this.onBackArrow({
                    node: this,
                    offset: beginning.length,
                    nodeStartTextOffset: childNodeStartTextOffset - beginning.length,
                    parents
                });
            }
        }
        public nextNodeReference(childNodeEndTextOffset: number, childIndex: number, parents: Parents) {
            if (childIndex + 1 < this.#children.length) {
                return {
                    node: this.#children[childIndex + 1],
                    offset: 0,
                    nodeStartTextOffset: childNodeEndTextOffset + separators[0].length,
                    parents: [
                        { node: this, childIndex: childIndex + 1 },
                        ...parents
                    ]
                }
            } else {
                return this.frontNodeReference(childNodeEndTextOffset + ending.length, parents);
            }
        }

        public frontNodeReference(nodeEndTextOffset: number, parents: Parents): NodeReference {
            const result = (parents.at(-1)?.node ?? this).getNodeAt(nodeEndTextOffset);
            assert(result.status === "found");

            return result;
        }

        private static isEmptyTag = (node: Node | undefined) => node instanceof TagNode && node.length() === 0;
    }
}

export class AndNode extends ParentNode("", [" "], "", (input) => input.length) {
    public constructor(children: Node[]) {
        super(children);
    }
    public static fromChildren = (children: Node[]) => new this(children);

    public static fromString = (input: string) => {
        const result = AndNode.tryParse(input);
        if (result.status !== "success") {
            throw Error("Failed to parse AndNode: " + JSON.stringify(result));
        }

        return result.node as AndNode;
    }
}

const matchBracket = (input: string) => {
    let endBracketIndex = 0;

    let count = 1;
    while (count > 0) {
        const openingBracketIndex = input.indexOf("{");
        const closingBracketIndex = input.indexOf("}");
        const bracketIndex = Math.min(
            openingBracketIndex === -1 ? Infinity : openingBracketIndex,
            closingBracketIndex === -1 ? Infinity : closingBracketIndex
        );

        if (bracketIndex === -1) {
            endBracketIndex = -1;

            break;
        } else if (input[bracketIndex] === "{") {
            count += 1;
        } else {
            count -= 1;
        }

        endBracketIndex += bracketIndex + 1;
        input = input.slice(bracketIndex + 1);
    };

    return endBracketIndex;
}
export class OrNode extends ParentNode("{", [" ~ ", " "], "}", matchBracket) {
    public constructor(children: Node[]) {
        super(children);
    }
    public static fromChildren = (children: Node[]) => new this(children);
}

export abstract class TagNode extends Node {
    public abstract isNegatable(textOffset: number): boolean;
    public abstract isGlobable(textOffset: number): boolean;
    public currentSegment(textOffset: number) {
        return this.content;
    }

    public abstract get content(): string;
    public abstract length(): number;

    protected constructor() {
        super();
    }

    public getNodeAt(textOffset: number): NodeResult {
        if (textOffset <= this.length()) {
            return { status: "found", node: this, offset: textOffset, nodeStartTextOffset: 0, parents: [] };
        } else {
            return { status: "continue", length: this.length() };
        }
    }

    public onBackArrow(reference: NodeReference) {
        if (reference.offset <= 0) {
            const immediateParent = reference.parents[0];
            if (immediateParent === undefined) {
                return reference;
            } else {
                return immediateParent.node.previousNodeReference(
                    reference.nodeStartTextOffset,
                    immediateParent.childIndex,
                    reference.parents.slice(1)
                );
            }
        } else {
            return {
                ...reference,
                offset: reference.offset - 1
            };
        }
    }
    public onForwardArrow(reference: NodeReference) {
        if (reference.offset >= this.length()) {
            const immediateParent = reference.parents[0];
            if (immediateParent === undefined) {
                return reference;
            } else {
                return immediateParent.node.nextNodeReference(
                    reference.nodeStartTextOffset + this.length(),
                    immediateParent.childIndex,
                    reference.parents.slice(1)
                );
            }
        } else {
            return {
                ...reference,
                offset: reference.offset + 1
            };
        }
    }

    public onSpace(reference: NodeReference) {
        const immediateParent = reference.parents[0];
        if (this.length() === 0 || immediateParent === undefined) {
            return reference;
        }

        if (reference.offset === this.length()) {
            return immediateParent.node.appendNodeAt(
                reference.nodeStartTextOffset + this.length(),
                immediateParent.childIndex,
                ContentTagNode.createEmpty(),
                reference.parents.slice(1)
            ) ?? reference;
        } else if (reference.offset === 0) {
            return immediateParent.node.prependNodeAt(
                reference.nodeStartTextOffset,
                immediateParent.childIndex,
                ContentTagNode.createEmpty(),
                reference.parents.slice(1)
            ) ?? reference;
        } else {
            const content = this.content;

            const rightContent = content.slice(reference.offset);
            const leftContent = content.slice(0, reference.offset);

            const rightHalfNodeInsertionResult = immediateParent.node.appendNodeAt(
                reference.nodeStartTextOffset + leftContent.length,
                immediateParent.childIndex,
                TagNode.parseTag(rightContent),
                reference.parents.slice(1)
            );
            if (rightHalfNodeInsertionResult === undefined) {
                return reference;
            }

            const leftHalfNodeReplacementResult = immediateParent.node.replaceNodeAt(
                reference.nodeStartTextOffset,
                immediateParent.childIndex,
                TagNode.parseTag(leftContent),
                reference.parents.slice(1),
            );
            assert(leftHalfNodeReplacementResult !== undefined);

            return rightHalfNodeInsertionResult;
        }
    }
    public onBackspace(reference: NodeReference) {
        const immediateParent = reference.parents[0];
        if (immediateParent === undefined) {
            return reference;
        }

        if (reference.offset > 0) {
            if (this.length() > 1) {
                const content = this.content;
                const nodeReplacementResult = immediateParent.node.replaceNodeAt(
                    reference.nodeStartTextOffset,
                    immediateParent.childIndex,
                    TagNode.parseTag(content.slice(0, reference.offset - 1) + content.slice(reference.offset)),
                    reference.parents.slice(1)
                );
                if (nodeReplacementResult !== undefined) nodeReplacementResult.offset = reference.offset - 1;

                return nodeReplacementResult ?? reference;
            } else {
                return immediateParent.node.deleteNodeAt(
                    reference.nodeStartTextOffset,
                    immediateParent.childIndex,
                    reference.parents.slice(1)
                );
            }
        } else {
            return immediateParent.node.unseparateNodeAt(
                reference.nodeStartTextOffset,
                immediateParent.childIndex,
                reference.parents.slice(1)
            );
        }
    }

    public tryMergeSibling(reference: NodeReference, leftNode: Node, leftNodeEndTextOffset: number): NodeReference | undefined {
        if (!(leftNode instanceof TagNode)) {
            return undefined;
        }

        const immediateParent = reference.parents[0]!;
        return {
            node: TagNode.parseTag(leftNode.content + this.content),
            nodeStartTextOffset: leftNodeEndTextOffset - leftNode.length(),
            offset: leftNode.length(),
            parents: [
                { node: immediateParent.node, childIndex: immediateParent.childIndex - 1 },
                ...reference.parents.slice(1)
            ],
        };
    }

    public frontNodeReference(nodeEndTextOffset: number, parents: Parents) {
        return {
            node: this,
            offset: this.length(),
            nodeStartTextOffset: nodeEndTextOffset - this.length(),
            parents
        }
    }

    public toString = () => this.content;

    public static parseTag = (input: string): TagNode => {
        let tag;
        for (const tryParse of tagNodeParsers) {
            const result = tryParse(input);

            if (result.status === "success") {
                tag = result.node;

                break;
            } else if (result.status === "dispose") {
                input = result.restInput;
            }
        }

        if (tag === undefined) {
            throw Error("Failed to parse tag node, all grammar rules rejected");
        }

        return tag as TagNode;
    }
}

export class ContentTagNode extends TagNode {
    public isNegatable(textOffset: number) { return true; }
    public isGlobable(textOffset: number) { return true; }

    #content: string;
    public get content() {
        return `${this.#content}`;
    }
    public set content(content: string) {
        if (content.match(/[\s{}]/) !== null) {
            throw Error(`Invalid tag content ${content}`);
        }

        this.#content = `${content}`;
    }
    public length = () => this.#content.length;

    public constructor(content: string) {
        super();

        this.#content = content;
        if (dev) this.content = this.#content;
    }

    public static createEmpty() {
        return new this("");
    }

    private static regex = /^(?![{}])[^\s{}]*/;
    public static tryParse(input: string): ParseResult {
        const result = this.regex.exec(input);
        if (result === null) {
            return { status: "reject" };
        }

        return { status: "success", node: new this(result[0]), restInput: input.slice(result[0].length) };
    };
}

export abstract class PrefixTagNode extends TagNode { }

interface SimplePrefixTagNode extends PrefixTagNode {
    get value(): string;
    set value(value: string);

    isInsideValue(textOffset: number): boolean;
}
const SimplePrefixTagNode = (prefix: string) => {
    return class SimplePrefixTagNode extends PrefixTagNode implements SimplePrefixTagNode {
        protected isNegated: boolean;

        public isNegatable(textOffset: number) { return !this.isNegated; }
        public isGlobable(textOffset: number) { return this.isInsideValue(textOffset); }

        #value: string;
        public get value() { return `${this.#value}`; };
        public set value(value: string) {
            if (value.match(/[\s{}]/) !== null) {
                throw Error(`Invalid tag value: ${value}`);
            }

            this.#value = `${value}`;
        }

        public get content() {
            return `${this.isNegated ? "-" : ""}${prefix}:${this.#value}`
        }

        public currentSegment(textOffset: number) {
            return this.isInsideValue(textOffset) ? this.value : this.content;
        }

        protected constructor(isNegated: boolean, value: string) {
            super()

            this.isNegated = isNegated;

            this.#value = value;
            if (dev) this.value = this.#value;
        }

        public isInsideValue = (textOffset: number) => (this.isNegated ? 1 : 0) + prefix.length + 1 <= textOffset;

        public length() { return (this.isNegated ? 1 : 0) + prefix.length + 1 + this.#value.length };

        private static valueRegex = /^[^\s{}]*/;
        public static tryParse(input: string): ParseResult {
            let isNegated = false;
            if (input.startsWith("-")) {
                isNegated = true;
                input = input.slice(1);
            }

            if (!input.startsWith(`${prefix}:`)) {
                return { status: "reject" };
            }
            input = input.slice(prefix.length + 1);

            const result = this.valueRegex.exec(input)!;

            return { status: "success", node: new this(isNegated, result[0]), restInput: input.slice(result[0].length) };
        };

        public isSimplePrefixTagNode = true;
    }
}
export class UserPrefixTagNode extends SimplePrefixTagNode("user") {
    public constructor(isNegated: boolean, user: string) {
        super(isNegated, user);
    }
}
export class Md5PrefixTagNode extends SimplePrefixTagNode("md5") {
    public constructor(isNegated: boolean, hash: string) {
        super(isNegated, hash);
    }
}
export class SourcePrefixTagNode extends SimplePrefixTagNode("source") {
    public constructor(isNegated: boolean, source: string) {
        super(isNegated, source);
    }
}
export class RatingPrefixTagNode extends SimplePrefixTagNode("rating") {
    public constructor(isNegated: boolean, rating: string) {
        super(isNegated, rating);
    }
}
export class FavPrefixTagNode extends SimplePrefixTagNode("fav") {
    public constructor(isNegated: boolean, of: string) {
        super(isNegated, of);
    }
}
export class PoolPrefixTagNode extends SimplePrefixTagNode("pool") {
    public constructor(isNegated: boolean, pool: string) {
        super(isNegated, pool);
    }
}
export const isSimplePrefixTagNode = (node: Node): node is SimplePrefixTagNode =>
    (node as any)?.isSimplePrefixTagNode ?? false;

export type Comparison = "=" | ">" | ">=" | "<" | "<=" | undefined;
interface ComparativePrefixTagNode extends SimplePrefixTagNode {
    get comparison(): Comparison;
    set comparison(comparison: Comparison);

    isInsideValue(textOffset: number): boolean;
    isInsideComparison(textOffset: number): boolean;
}
const ComparativePrefixTagNode = (prefix: string) => {
    return class ComparativePrefixTagNodeInner extends SimplePrefixTagNode(prefix) implements ComparativePrefixTagNode {
        public isNegatable(textOffset: number) { return false; }
        public isGlobable(textOffset: number) { return false; }

        #comparison: Comparison;
        public get comparison() { return this.#comparison === undefined ? undefined : `${this.#comparison}`; };
        public set comparison(comparison: Comparison) {
            this.#comparison = comparison === undefined ? undefined : `${comparison}`;
        }

        public get content() {
            return `${prefix}:${this.#comparison ?? ""}${this.value}`;
        }

        public currentSegment(textOffset: number) {
            return this.isInsideComparison(textOffset) ?
                (this.comparison ?? "") :
                this.isInsideValue(textOffset) ?
                    this.value :
                    this.content;
        }

        protected constructor(comparison: Comparison, value: string) {
            super(false, value)

            this.#comparison = comparison;
            if (dev) this.comparison = this.#comparison;
        }

        public isInsideValue = (textOffset: number) => (prefix.length + 1) + (this.#comparison ?? "").length <= textOffset;
        public isInsideComparison = (textOffset: number) =>
            ((prefix.length + 1) + (this.#comparison ?? "").length >= textOffset) && textOffset >= prefix.length + 1;

        public length = () => super.length() + (this.#comparison ?? "").length;

        private static postPrefixRegex = /^(=|>=|<=|>|<)?([^\s{}]*)/;
        public static tryParse(input: string): ParseResult {
            if (!input.startsWith(`${prefix}:`)) {
                return { status: "reject" };
            }
            input = input.slice(prefix.length + 1);

            const result = this.postPrefixRegex.exec(input)!;

            return {
                status: "success",
                node: new this((result[1] ?? undefined) as Comparison, result[2] ?? ""),
                restInput: input.slice(result[0].length)
            };
        };

        public isComparativePrefixTagNode = true;
    }
}
export class WidthPrefixTagNode extends ComparativePrefixTagNode("width") {
    public constructor(comparison: Comparison, width: string) {
        super(comparison, width);
    }
}
export class HeightPrefixTagNode extends ComparativePrefixTagNode("height") {
    public constructor(comparison: Comparison, height: string) {
        super(comparison, height);
    }
}
export class ScorePrefixTagNode extends ComparativePrefixTagNode("score") {
    public constructor(comparison: Comparison, score: string) {
        super(comparison, score);
    }
}
export const isComparativePrefixTagNode = (node: Node): node is ComparativePrefixTagNode =>
    (node as any)?.isComparativePrefixTagNode ?? false;

type SortValue =
    { random: "random", option: undefined, seed: string | undefined } |
    { random: undefined, option: string, order: "asc" | "desc" | string | undefined };
export class SortPrefixTagNode extends PrefixTagNode {
    public isNegatable(textOffset: number) { return false; }
    public isGlobable(textOffset: number) { return false; }

    #value: SortValue;
    public get value() { return structuredClone(this.#value); };
    private set value(value: SortValue) {
        if (
            value.option === "random" ||
            (value.option ?? value.random).match(/[\s{}]/) !== null ||
            (value.random === "random" && (value.seed ?? "").match(/[\s{}]/) !== null) ||
            (value.option !== undefined && (value.order ?? "").match(/[\s{}]/) !== null)
        ) {
            throw Error(`Invalid tag value: ${JSON.stringify(value)}`);
        }

        this.#value = structuredClone(value);
    }

    public get option() {
        return `${this.#value.option ?? this.#value.random}`;
    }
    public set option(option: string) {
        if (option === "random") {
            this.value = {
                random: "random",
                option: undefined,
                seed: this.#value.random === undefined ? this.#value.order : this.#value.seed
            };
        } else {
            this.value = {
                random: undefined,
                option,
                order: this.#value.random === undefined ? this.#value.order : this.#value.seed
            };
        }
    }

    public get order() {
        const order = this.#value.random === undefined ? this.#value.order : this.#value.seed;
        return order === undefined ? undefined : `${order}`;
    }
    public set order(order: string | undefined) {
        if (this.#value.random === "random") {
            this.value = {
                random: "random",
                option: undefined,
                seed: order
            };
        } else {
            this.value = {
                random: undefined,
                option: this.#value.option,
                order
            };
        }
    }

    public get content() {
        let content = "sort:";
        content += this.#value.option ?? this.#value.random;
        if (this.#value.option === undefined) {
            content += this.#value.seed === undefined ? "" : `:${this.#value.seed}`;
        } else {
            content += this.#value.order === undefined ? "" : `:${this.#value.order}`
        }

        return content;
    }

    public currentSegment(textOffset: number) {
        return this.isInsideOption(textOffset) ?
            this.option :
            this.isInsideOrder(textOffset) ?
                (this.order ?? "") :
                this.content;
    }

    public constructor(value: SortValue) {
        super();

        this.#value = value;
        if (dev) this.#value = this.#value;
    }

    public isInsideOption = (textOffset: number) =>
        "sort:".length <= textOffset &&
        textOffset <= ((this.#value.option ?? this.#value.random).length + "sort:".length);
    public isInsideOrder = (textOffset: number) =>
        ((this.#value.option === undefined && this.#value.seed !== undefined) ||
            this.#value.random === undefined && this.#value.order !== undefined)
        && textOffset > ((this.#value.option ?? this.#value.random).length + "sort:".length);

    public length = () => {
        return "sort:".length +
            (this.#value.option ?? this.#value.random).length +
            (this.#value.option === undefined ?
                this.#value.seed === undefined ? 0 : this.#value.seed.length + 1 :
                this.#value.order === undefined ? 0 : this.#value.order.length + 1)
    };

    private static postPrefixRegex = /^([^\s{}:]*)(?::([^\s{}]*))?/;
    public static tryParse(input: string): ParseResult {
        if (!input.startsWith("sort:")) {
            return { status: "reject" };
        }
        input = input.slice("sort:".length);

        const result = this.postPrefixRegex.exec(input)!;
        const value = result[1] === "random" ? {
            random: "random" as const,
            seed: result[2]
        } : {
            option: result[1],
            order: result[2]
        };

        return {
            status: "success",
            node: new this(value),
            restInput: input.slice(result[0].length)
        };
    };
}

const tagNodeParsers = [
    SortPrefixTagNode.tryParse.bind(SortPrefixTagNode),
    WidthPrefixTagNode.tryParse.bind(WidthPrefixTagNode),
    HeightPrefixTagNode.tryParse.bind(HeightPrefixTagNode),
    ScorePrefixTagNode.tryParse.bind(ScorePrefixTagNode),
    Md5PrefixTagNode.tryParse.bind(Md5PrefixTagNode),
    RatingPrefixTagNode.tryParse.bind(RatingPrefixTagNode),
    FavPrefixTagNode.tryParse.bind(FavPrefixTagNode),
    PoolPrefixTagNode.tryParse.bind(PoolPrefixTagNode),
    ContentTagNode.tryParse.bind(ContentTagNode)
];

const childNodeParsers = [
    OrNode.tryParse.bind(OrNode),
    ...tagNodeParsers
];