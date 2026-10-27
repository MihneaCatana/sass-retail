import { Component, Directive, TemplateRef, contentChildren, inject, input, output, signal } from '@angular/core';
import type { Sort, SortDirection } from '@angular/material/sort';
import { NgTemplateOutlet } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n';

/** One column of the data table. */
export interface DataTableColumn {
  /** Row property rendered by default when no cell template is projected. */
  key: string;
  label: string;
  /** Cell/header text alignment; defaults to left. */
  align?: 'left' | 'right';
  /** Locks the column width (e.g. '11rem'). */
  width?: string;
  /** Keeps long labels or primary values readable in narrow table layouts. */
  minWidth?: string;
  /** Prevents the cell content from wrapping. */
  nowrap?: boolean;
  sortable?: boolean;
  /** Excludes a column from the table's visibility chooser. */
  hideable?: boolean;
}

/**
 * Marks a projected ng-template as the cell renderer for one column
 * (`<ng-template appTableCell="sku" let-row>`). Template context: { $implicit: row }.
 */
@Directive({
  selector: 'ng-template[appTableCell]'
})
export class DataTableCell {
  readonly templateRef = inject(TemplateRef);
  readonly column = input.required<string>({ alias: 'appTableCell' });
}

/**
 * Reusable app table with custom sortable headers, a keyboard-accessible scroll
 * region, theme-token surfaces, and projected cell renderers. Columns are
 * configured via inputs; cells render from `<ng-template appTableCell="key">`
 * templates, falling back to the raw row value when no template exists.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss'
})
export class DataTable<T> {
  readonly columns = input.required<DataTableColumn[]>();
  readonly rows = input.required<T[]>();
  readonly ariaLabel = input.required<string>();
  readonly sortActive = input('');
  readonly sortDirection = input<SortDirection>('');
  readonly sortChange = output<Sort>();

  protected readonly i18n = inject(I18nService);
  private readonly hiddenColumns = signal<ReadonlySet<string>>(new Set());
  readonly cells = contentChildren(DataTableCell);

  protected cellFor(key: string): DataTableCell | undefined {
    return this.cells().find((cell) => cell.column() === key);
  }

  protected rowValue(row: T, key: string): string {
    return String((row as Record<string, unknown>)[key] ?? '');
  }

  protected sortState(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortActive() !== key || !this.sortDirection()) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected toggleSort(key: string): void {
    const direction: SortDirection = this.sortActive() !== key
      ? 'asc'
      : this.sortDirection() === 'asc'
        ? 'desc'
        : this.sortDirection() === 'desc'
          ? ''
          : 'asc';
    this.sortChange.emit({ active: key, direction });
  }

  protected visibleColumns(): DataTableColumn[] {
    const hidden = this.hiddenColumns();
    return this.columns().filter((column) => !hidden.has(column.key));
  }

  protected isColumnVisible(key: string): boolean {
    return !this.hiddenColumns().has(key);
  }

  protected canHideColumn(key: string): boolean {
    return !this.isColumnVisible(key) || this.visibleColumns().length > 1;
  }

  protected toggleColumn(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.hiddenColumns.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.delete(key);
      } else if (this.visibleColumns().length > 1) {
        next.add(key);
      }
      return next;
    });
  }
}
