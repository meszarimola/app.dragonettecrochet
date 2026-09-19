// Layers of the free-form drawing. KB: interface.md §39

import { nextId } from './irregular-document.ts';
import type { IrregularLayer, IrregularPattern } from './irregular-types.ts';

export type LayerPatch = Partial<Pick<IrregularLayer, 'name' | 'visible' | 'locked'>>;

export function layerIndex(pattern: IrregularPattern, layerId: string): number {
  return pattern.layers.findIndex((layer) => layer.id === layerId);
}

export function addLayer(pattern: IrregularPattern, name: string): { pattern: IrregularPattern; id: string } {
  const id = nextId(
    'l',
    pattern.layers.map((layer) => layer.id),
  );
  const layer: IrregularLayer = { id, name, visible: true, locked: false };
  return { pattern: { ...pattern, layers: [...pattern.layers, layer] }, id };
}

export function updateLayer(pattern: IrregularPattern, layerId: string, patch: LayerPatch): IrregularPattern {
  const layer = pattern.layers.find((candidate) => candidate.id === layerId);
  if (layer === undefined) return pattern;
  const next = { ...layer, ...patch };
  if (next.name === layer.name && next.visible === layer.visible && next.locked === layer.locked) return pattern;
  return { ...pattern, layers: pattern.layers.map((candidate) => (candidate.id === layerId ? next : candidate)) };
}

export function setActiveLayer(pattern: IrregularPattern, layerId: string): IrregularPattern {
  if (layerId === pattern.activeLayerId || layerIndex(pattern, layerId) < 0) return pattern;
  return { ...pattern, activeLayerId: layerId };
}

/** The layer goes with everything drawn on it; undo is what brings it back. */
export function deleteLayer(pattern: IrregularPattern, layerId: string): IrregularPattern {
  if (pattern.layers.length < 2) return pattern;
  const index = layerIndex(pattern, layerId);
  if (index < 0) return pattern;
  const layers = pattern.layers.filter((layer) => layer.id !== layerId);
  const fallback = layers[Math.max(0, index - 1)] ?? layers[0];
  if (fallback === undefined) return pattern;
  return {
    ...pattern,
    layers,
    items: pattern.items.filter((item) => item.layerId !== layerId),
    activeLayerId: pattern.activeLayerId === layerId ? fallback.id : pattern.activeLayerId,
  };
}

/** The list order is the z-order: the first layer is drawn at the bottom. */
export function reorderLayers(pattern: IrregularPattern, layerId: string, toIndex: number): IrregularPattern {
  const from = layerIndex(pattern, layerId);
  if (from < 0) return pattern;
  const target = Math.max(0, Math.min(pattern.layers.length - 1, toIndex));
  if (target === from) return pattern;
  const layers = [...pattern.layers];
  const [moved] = layers.splice(from, 1);
  if (moved === undefined) return pattern;
  layers.splice(target, 0, moved);
  return { ...pattern, layers };
}

export function moveItemsToLayer(pattern: IrregularPattern, ids: Iterable<string>, layerId: string): IrregularPattern {
  const chosen = new Set(ids);
  if (chosen.size === 0 || layerIndex(pattern, layerId) < 0) return pattern;
  let changed = false;
  const items = pattern.items.map((item) => {
    if (!chosen.has(item.id) || item.layerId === layerId) return item;
    changed = true;
    return { ...item, layerId };
  });
  return changed ? { ...pattern, items } : pattern;
}

export function itemsOfLayer(pattern: IrregularPattern, layerId: string): number {
  return pattern.items.reduce((total, item) => (item.layerId === layerId ? total + 1 : total), 0);
}
