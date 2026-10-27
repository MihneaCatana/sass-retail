import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n';

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.removeItem('retail.lang');
    document.documentElement.lang = '';
  });

  it('defaults to English and translates keys', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.lang()).toBe('en');
    expect(i18n.t('products.title')).toBe('Products');
    expect(i18n.t('productEdit.sku')).toBe('Product code (SKU)');
  });

  it('interpolates {param} placeholders', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.t('products.pager', { page: 1, pages: 3, count: 27 })).toBe(
      'Page 1 of 3 — 27 product(s)'
    );
  });

  it('switches to Romanian, keeps placeholders working, and persists the choice', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('ro');
    expect(i18n.lang()).toBe('ro');
    expect(i18n.t('products.title')).toBe('Produse');
    expect(i18n.t('products.pager', { page: 2, pages: 5, count: 42 })).toBe(
      'Pagina 2 din 5 — 42 produs(e)'
    );
    expect(localStorage.getItem('retail.lang')).toBe('ro');
  });

  it('restores the persisted language on startup', () => {
    localStorage.setItem('retail.lang', 'ro');
    const i18n = TestBed.inject(I18nService);
    expect(i18n.lang()).toBe('ro');
    expect(i18n.t('products.title')).toBe('Produse');
  });

  it('syncs <html lang> with the active language', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('ro');
    // Effects flush on the application tick (zoneless).
    TestBed.inject(ApplicationRef).tick();
    expect(document.documentElement.lang).toBe('ro');
  });
});