import { Component, effect, inject, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n';
import { formatAppDateTime } from '../../../core/i18n/date-format';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { WORKSPACE_MODULE_KEYS, type TenantDetail as TenantDetailDto, type WorkspaceModuleKey, type WorkspaceModules } from '@retail/shared-types';

/** Platform-admin drill-down for one registry tenant: facts + audit trail. */
@Component({
  selector: 'app-tenant-detail',
  imports: [JsonPipe, RouterLink, StatusBadge],
  templateUrl: './tenant-detail.html',
  styleUrl: './tenant-detail.scss'
})
export class TenantDetail {
  /** Bound from the route parameter (withComponentInputBinding). */
  readonly slug = input.required<string>();

  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  protected readonly moduleChoices = WORKSPACE_MODULE_KEYS.map((key) => ({ key, labelKey: `tenantDetail.module.${key}` as const }));
  protected readonly moduleDraft = signal<WorkspaceModuleKey[] | null>(null);
  protected readonly savedModules = signal<WorkspaceModuleKey[]>([]);
  protected readonly moduleSaving = signal(false);
  protected readonly moduleSaveError = signal(false);
  protected readonly moduleSaveSuccess = signal(false);
  private readonly moduleWorkspace = signal('');

  readonly detail = httpResource<TenantDetailDto>(() =>
    this.slug() ? `/api/platform/tenants/${this.slug()}` : undefined
  );

  constructor() {
    effect(() => {
      if (!this.detail.hasValue()) return;
      const detail = this.detail.value();
      if (detail.tenant.slug !== this.slug()) return;
      const modules = detail.enabledModules ?? [];
      if (this.moduleWorkspace() !== detail.tenant.slug) {
        this.moduleWorkspace.set(detail.tenant.slug);
        this.moduleDraft.set([...modules]);
        this.savedModules.set([...modules]);
      }
    });
  }

  protected selectedModules(): WorkspaceModuleKey[] {
    const draft = this.moduleDraft();
    if (draft) return draft;
    return this.detail.hasValue() ? this.detail.value().enabledModules ?? [] : [];
  }

  protected hasModuleChanges(): boolean {
    const current = [...this.selectedModules()].sort();
    const saved = [...this.savedModules()].sort();
    return current.length !== saved.length || current.some((key, index) => key !== saved[index]);
  }

  protected toggleModule(key: WorkspaceModuleKey, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.selectedModules();
    this.moduleDraft.set(checked
      ? [...current, key]
      : current.filter((module) => module !== key));
    this.moduleSaveError.set(false);
    this.moduleSaveSuccess.set(false);
  }

  protected async saveModules(): Promise<void> {
    if (!this.hasModuleChanges()) return;
    this.moduleSaving.set(true);
    this.moduleSaveError.set(false);
    this.moduleSaveSuccess.set(false);
    const enabledModules = [...this.selectedModules()];
    try {
      const result = await firstValueFrom(this.http.put<WorkspaceModules>(
        `/api/platform/tenants/${this.slug()}/modules`,
        { enabledModules }
      ));
      this.moduleDraft.set([...result.enabledModules]);
      this.savedModules.set([...result.enabledModules]);
      this.moduleSaveSuccess.set(true);
      this.detail.reload();
    } catch {
      this.moduleSaveError.set(true);
    } finally {
      this.moduleSaving.set(false);
    }
  }

  protected dateTime(value: string): string { return formatAppDateTime(value); }
}
