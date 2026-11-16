export const environment = {
  production: false,
  bffBaseUrl: 'http://localhost:4000/api',
  // Amazon Cognito (compradores y vendedores). Identificadores públicos, no son secretos.
  // redirectUri / postLogoutRedirectUri deben estar registrados en el App Client (Páginas de inicio de sesión).
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_nBO3iQNzO',
    clientId: '1f6tqiu9d5sh2lq3vif390jgfa',
    domain: 'https://pcb-auth-614788327678.auth.us-east-1.amazoncognito.com',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
  },
  msal: {
    // Azure Entra ID (Azure AD) App Registration — plataforma "Single-page application".
    // Reemplazar con los valores reales del tenant. Ver README para los pasos de alta.
    clientId: '6c2342af-22f6-4de8-a545-2a3b04e7d1ff',
    tenantId: '35365687-614a-481c-8b8b-b4debee24880',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
    // Autoridad de alta de usuario. Vacía => se usa prompt=create sobre el tenant
    // de Entra ID. Para B2C poner p.ej. "https://<tenant>.b2clogin.com/<tenant>.<onmicrosoft.com>/B2C_1_signupsignin".
    signUpAuthority: '',
  },
};

