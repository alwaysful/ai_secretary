import { api } from '../../shared/api';
import { setAdminToken } from '../../shared/adminToken';

export { currentToken, isAdmin, setAdminToken } from '../../shared/adminToken';

/** 코드는 서버에서 검증. 프런트에 코드 없음 */
export async function adminLogin(code: string): Promise<void> {
  const r = await api.adminLogin(code);
  setAdminToken(r.token);
}
