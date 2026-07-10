import { api } from './api';
import type { FirestoreHotPathReport } from '../types/firestoreHotPath';

type Envelope<T> = T & { ok?: boolean };

export const firestoreHotPathApi = {
  getReport: () =>
    api
      .get<Envelope<{ report: FirestoreHotPathReport }>>('/api/admin/firestore/hot-paths')
      .then((response) => response.report),
};
