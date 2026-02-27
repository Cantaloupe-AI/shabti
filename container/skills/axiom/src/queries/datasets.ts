/**
 * Dataset operations
 *
 * AIDEV-NOTE: list-datasets uses the v2 management API (axiomGet).
 * list-fields uses the v1 query API via APL getschema because the query token
 * does not have v2 dataset:read permissions.
 */

import { axiomGet, axiomQuery, getDefaultDataset } from '../client';
import type { AxiomDataset, AxiomField, AxiomQueryResponse } from '../types';

/**
 * List all datasets
 */
export async function listDatasets(): Promise<AxiomDataset[]> {
  return axiomGet<AxiomDataset[]>('/datasets');
}

/**
 * Get dataset info
 */
export async function getDataset(datasetId: string): Promise<AxiomDataset> {
  return axiomGet<AxiomDataset>(`/datasets/${encodeURIComponent(datasetId)}`);
}

/**
 * List fields for a dataset using APL getschema operator.
 * Uses the query API (v1) which the AXIOM_QUERY_TOKEN has access to.
 */
export async function listFields(datasetId: string): Promise<AxiomField[]> {
  const apl = `['${datasetId}'] | getschema`;
  const result = await axiomQuery<AxiomQueryResponse>({
    apl,
    startTime: 'now-1h',
    endTime: 'now',
  });

  // getschema returns columns: ColumnName, ColumnOrdinal, DataType, ColumnType
  const table = result.tables[0];
  if (!table || table.columns.length === 0) {
    return [];
  }

  const fieldNames = table.fields.map(f => f.name);
  const nameIdx = fieldNames.indexOf('ColumnName');
  const typeIdx = fieldNames.indexOf('DataType');
  const rowCount = table.columns[0]?.length ?? 0;

  const fields: AxiomField[] = [];
  for (let i = 0; i < rowCount; i++) {
    const name = nameIdx >= 0 ? String(table.columns[nameIdx]?.[i] ?? '') : '';
    const type = typeIdx >= 0 ? String(table.columns[typeIdx]?.[i] ?? '') : '';
    if (name) {
      fields.push({ name, type });
    }
  }

  return fields.sort((a, b) => a.name.localeCompare(b.name));
}
