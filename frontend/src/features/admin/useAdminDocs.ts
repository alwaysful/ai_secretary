import { useEffect, useState } from 'react';
import { AdminDocs, api } from '../../shared/api';
import { currentToken } from '../../shared/adminToken';

/** 관리자 세션일 때만 서버에서 관리자 문서 받음. 일반 모드는 null */
export function useAdminDocs(): AdminDocs | null {
  const [docs, setDocs] = useState<AdminDocs | null>(null);
  useEffect(() => {
    const t = currentToken();
    if (!t) return;
    let alive = true;
    api.adminDocs(t).then(
      (d) => alive && setDocs(d),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  return docs;
}
