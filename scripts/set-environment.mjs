import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name, fallback) => process.env[name] || fallback; // un secreto sin definir llega vacío: cuenta como ausente

const environment = {
  production: true,
  bffBaseUrl: read('BFF_BASE_URL', 'http://localhost:4000/api'),
  cognito: {
    region: read('COGNITO_REGION', 'us-east-1'),
    userPoolId: read('COGNITO_USER_POOL_ID', 'us-east-1_nBO3iQNzO'),
    clientId: read('COGNITO_CLIENT_ID', '1f6tqiu9d5sh2lq3vif390jgfa'),
    domain: read('COGNITO_DOMAIN', 'https://pcb-auth-614788327678.auth.us-east-1.amazoncognito.com'),
    redirectUri: read('COGNITO_REDIRECT_URI', 'https://orlandodiaz2003.github.io/pcmarketbuilder-front-fork/'),
    postLogoutRedirectUri: read('COGNITO_POST_LOGOUT_REDIRECT_URI', 'https://orlandodiaz2003.github.io/pcmarketbuilder-front-fork/')
  },
  msal: {
    clientId: read('MSAL_CLIENT_ID', '6c2342af-22f6-4de8-a545-2a3b04e7d1ff'),
    tenantId: read('MSAL_TENANT_ID', '35365687-614a-481c-8b8b-b4debee24880'),
    redirectUri: read('MSAL_REDIRECT_URI', 'https://localhost:4200'),
    postLogoutRedirectUri: read('MSAL_POST_LOGOUT_REDIRECT_URI', 'https://localhost:4200'),
    signUpAuthority: read('MSAL_SIGN_UP_AUTHORITY', '')
  }
};

const content = [
  'export const environment = {',
  `  production: ${environment.production},`,
  `  bffBaseUrl: '${environment.bffBaseUrl}',`,
  '  cognito: {',
  `    region: '${environment.cognito.region}',`,
  `    userPoolId: '${environment.cognito.userPoolId}',`,
  `    clientId: '${environment.cognito.clientId}',`,
  `    domain: '${environment.cognito.domain}',`,
  `    redirectUri: '${environment.cognito.redirectUri}',`,
  `    postLogoutRedirectUri: '${environment.cognito.postLogoutRedirectUri}',`,
  '  },',
  '  msal: {',
  `    clientId: '${environment.msal.clientId}',`,
  `    tenantId: '${environment.msal.tenantId}',`,
  `    redirectUri: '${environment.msal.redirectUri}',`,
  `    postLogoutRedirectUri: '${environment.msal.postLogoutRedirectUri}',
    signUpAuthority: '${environment.msal.signUpAuthority}',`,
  '  },',
  '};',
  ''
].join('\n');

writeFileSync(join(root, 'src', 'environments', 'environment.prod.ts'), content);
console.log('src/environments/environment.prod.ts generado desde variables de entorno.');