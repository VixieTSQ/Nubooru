export const minColumnWidthPx = 190;
export const gap = 12;
const maxVerticalGap = 35;
const doubleWideOpportunityRatio = 1.35;

export interface MasonryItem {
    id: number,
    preview_width: number,
    preview_height: number
}

export type Brick<Item extends MasonryItem> = {
    item: Item;
    left: number;
    right: number;
    top: number;
    bottom: number;
};

type ColumnState = {
    widthPx: number,
    numberOfColumns: number,
    columnTopPositionsPx: number[],
    columnBottomPositionsPx: number[],
    columnHasDoubleWide: boolean[]
};

export default class MasonryManager<Item extends MasonryItem> {
    public bricks: Brick<Item>[] = $state([]);

    private addedItemIds: Set<number> = new Set();
    private columnState: ColumnState | undefined = undefined;

    private static calculateBrickPosition = (brickIntrinsicWidth: number, brickIntrinsicHeight: number, columnState: ColumnState) => {
        const widthPerColumnPx = this.calculateWidthPerColumn(columnState.widthPx, columnState.numberOfColumns);

        let highestColumn = 0;
        let bottomPx = columnState.columnBottomPositionsPx[highestColumn];
        columnState.columnBottomPositionsPx.forEach((columnBottomPx, index) => {
            if (bottomPx > columnBottomPx) {
                highestColumn = index;
                bottomPx = columnBottomPx;
            }
        });

        const widthPerColumnPlusGap = widthPerColumnPx + gap;

        let leftSideColumnIndex = highestColumn;
        let rightSideColumnIndex = highestColumn;
        let top = columnState.columnBottomPositionsPx[highestColumn];

        if (brickIntrinsicWidth / brickIntrinsicHeight > doubleWideOpportunityRatio) {
            const columnLeftIndex = highestColumn - 1;
            const columnRightIndex = highestColumn + 1;
            const columnLeftBottomPx = columnState.columnBottomPositionsPx[columnLeftIndex];
            const columnRightBottomPx = columnState.columnBottomPositionsPx[columnRightIndex];

            const thisColumnHasDoubleWide = columnState.columnHasDoubleWide[highestColumn];

            // TODO: Randomly select between the two to avoid bias? But seeded how?
            if (
                columnLeftBottomPx !== undefined &&
                columnLeftBottomPx - bottomPx <= maxVerticalGap &&
                !(columnState.columnHasDoubleWide[columnLeftIndex] && thisColumnHasDoubleWide)
            ) {
                leftSideColumnIndex = columnLeftIndex;
                top = columnLeftBottomPx;
            } else if (
                columnRightBottomPx !== undefined &&
                columnRightBottomPx - bottomPx <= maxVerticalGap &&
                !(columnState.columnHasDoubleWide[columnRightIndex] && thisColumnHasDoubleWide)
            ) {
                rightSideColumnIndex = columnRightIndex;
                top = columnRightBottomPx;
            }
        }

        top = top === 0 ? top : top + gap;

        const left = leftSideColumnIndex * widthPerColumnPlusGap;
        const right =
            (rightSideColumnIndex + 1) * widthPerColumnPlusGap - gap;
        const width = right - left;
        const height = brickIntrinsicHeight * (width / brickIntrinsicWidth);
        const bottom = top + height;

        for (
            let occupiedColumnIndex = leftSideColumnIndex;
            occupiedColumnIndex <= rightSideColumnIndex;
            occupiedColumnIndex++
        ) {
            columnState.columnBottomPositionsPx[occupiedColumnIndex] = bottom;

            if (leftSideColumnIndex != rightSideColumnIndex) {
                columnState.columnHasDoubleWide[occupiedColumnIndex] = true;
            } else {
                columnState.columnHasDoubleWide[occupiedColumnIndex] = false;
            }
        }

        return {
            left: left,
            right: right,
            top: top,
            bottom: bottom,
        };
    }

    private static calculateNumberOfColumns = (width: number) => Math.floor(
        (width + gap) / (minColumnWidthPx + gap),
    );
    private static calculateWidthPerColumn = (width: number, numberOfColumns: number) => (width - Math.max(numberOfColumns - 1, 0) * gap) / numberOfColumns;

    // TODO: Pick a brick to anchor our scroll to (I think).
    public onWidthChange = (masonryWidth: number) => {
        if (masonryWidth === this.columnState?.widthPx) {
            return;
        }

        const numberOfColumns = MasonryManager.calculateNumberOfColumns(masonryWidth);

        if (this.columnState?.numberOfColumns !== numberOfColumns) {
            this.columnState = {
                widthPx: masonryWidth,
                numberOfColumns,
                columnTopPositionsPx: Array(numberOfColumns).fill(0),
                columnBottomPositionsPx: Array(numberOfColumns).fill(0),
                columnHasDoubleWide: Array(numberOfColumns).fill(true)
            };
        }

        this.columnState.widthPx = masonryWidth;
        this.columnState.columnBottomPositionsPx = [...this.columnState.columnTopPositionsPx];

        for (const brick of this.bricks) {
            const { left, right, top, bottom } = MasonryManager.calculateBrickPosition(
                brick.item.preview_width,
                brick.item.preview_height,
                this.columnState
            );

            brick.left = left;
            brick.right = right;
            brick.top = top;
            brick.bottom = bottom;
        }
    };

    public addItems = (newItems: Item[], masonryWidth: number) => {
        const filteredNewItems = newItems.filter((item) => !this.addedItemIds.has(item.id));
        filteredNewItems.forEach((item) => this.addedItemIds.add(item.id));

        if (this.columnState?.widthPx !== masonryWidth) {
            this.onWidthChange(masonryWidth); // asserts this.columnState is not undefined.
        }

        for (const item of filteredNewItems) {
            const position = MasonryManager.calculateBrickPosition(
                item.preview_width,
                item.preview_height,
                this.columnState!
            );

            this.bricks.push({ item, ...position });
        }
    };

    public removeItems = (upToIndex: number, masonryWidth: number) => {
        if (this.columnState?.widthPx !== masonryWidth) {
            this.onWidthChange(masonryWidth); // asserts this.columnState is not undefined.
        }

        this.bricks = this.bricks.slice(upToIndex);

        const numberOfColumns = MasonryManager.calculateNumberOfColumns(masonryWidth);
        const widthPerColumnPx = MasonryManager.calculateWidthPerColumn(masonryWidth, numberOfColumns);
        const widthPerColumnPlusGap = widthPerColumnPx + gap;

        let newTopPositionsPx = Array(...this.columnState!.columnBottomPositionsPx);
        for (const brick of this.bricks) {
            const columnIndex = brick.left / widthPerColumnPlusGap;

            newTopPositionsPx[columnIndex] = Math.min(brick.top, newTopPositionsPx[columnIndex]);
        }

        const offset = newTopPositionsPx.reduce((currentMin, columnTopPx) => Math.min(columnTopPx, currentMin), Infinity);
        if (offset !== 0) {
            window.scroll({
                top: window.scrollY - offset,
                behavior: "instant"
            });
        }

        for (const brick of this.bricks) {
            brick.top = brick.top - offset;
            brick.bottom = brick.bottom - offset
        }

        this.columnState!.columnTopPositionsPx = newTopPositionsPx.map((columnTopPx) => columnTopPx - offset);
        this.columnState!.columnBottomPositionsPx = this.columnState!.columnBottomPositionsPx.map((columnBottomPx) => columnBottomPx - offset);
    }
}