import { ensureWebClientSubject } from '../src/lib/keycloakAdmin';

ensureWebClientSubject().catch((error) => { console.error(error); process.exitCode = 1; });
